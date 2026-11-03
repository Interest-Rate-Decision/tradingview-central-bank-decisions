#!/usr/bin/env node
// Writes central-bank-decisions.pine from src/template.pine with the decisions
// of ten central banks from InterestRateDecision.com's open data, and the
// "Next decisions" table of README.md.
//
//   node scripts/generate.mjs                 fetch the live files
//   node scripts/generate.mjs --offline DIR   read decisions.csv, next.json and calendar.ics from DIR
//   node scripts/generate.mjs --check         exit 1 if the committed files are not up to date
//
// Sources (free to reuse with a link to https://interestratedecision.com):
//   /data/decisions.csv  every decision since 2008: bank,bank_name,time_utc,date,rate,change_bp
//   /data/next.json      the decisions of the next ~90 days, with the rate before each
//   /calendar.ics        the dates of the year ahead (only DTSTART, UID and STATUS are read)
//
// Pine Script cannot fetch anything, so the data goes into the script as one
// string per bank. History starts on 1 January FIRST_YEAR to keep the script
// small and the chart readable; the README says so.
//
// Node 18 or later, no dependencies.

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const FIRST_YEAR = 2020;
export const SITE = 'https://interestratedecision.com';
export const VIA = 'tv-decisions';

// The order is the script's: index 0 is the Fed. Keep it in step with BANK_* in src/template.pine.
export const BANKS = [
  { id: 'fed', short: 'Fed', name: 'Federal Reserve', ccy: 'USD' },
  { id: 'ecb', short: 'ECB', name: 'European Central Bank', ccy: 'EUR' },
  { id: 'boe', short: 'BoE', name: 'Bank of England', ccy: 'GBP' },
  { id: 'boj', short: 'BoJ', name: 'Bank of Japan', ccy: 'JPY' },
  { id: 'boc', short: 'BoC', name: 'Bank of Canada', ccy: 'CAD' },
  { id: 'rba', short: 'RBA', name: 'Reserve Bank of Australia', ccy: 'AUD' },
  { id: 'rbnz', short: 'RBNZ', name: 'Reserve Bank of New Zealand', ccy: 'NZD' },
  { id: 'snb', short: 'SNB', name: 'Swiss National Bank', ccy: 'CHF' },
  { id: 'norges', short: 'Norges Bank', name: 'Norges Bank', ccy: 'NOK' },
  { id: 'riksbank', short: 'Riksbank', name: 'Sveriges Riksbank', ccy: 'SEK' },
];
const KNOWN = new Set(BANKS.map((b) => b.id));

// One bank's string may not pass this many characters (Pine's strings stay far
// below their limits, and a script this size compiles well inside the
// 100,256-token limit: each string is one token).
export const MAX_BANK_CHARS = 4000;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Parses IRD's decisions.csv (no quoted fields in it; a quoted one fails loudly). */
export function parseCsv(text) {
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim() !== '');
  const head = lines.shift().split(',');
  const need = ['bank', 'time_utc', 'rate', 'change_bp'];
  for (const n of need) if (!head.includes(n)) throw new Error(`decisions.csv: no "${n}" column (has ${head.join(',')})`);
  return lines.map((line, i) => {
    if (line.includes('"')) throw new Error(`decisions.csv line ${i + 2}: quoted fields are not expected`);
    const cells = line.split(',');
    const row = Object.fromEntries(head.map((h, j) => [h, cells[j] ?? '']));
    const t = Date.parse(row.time_utc);
    if (Number.isNaN(t)) throw new Error(`decisions.csv line ${i + 2}: bad time "${row.time_utc}"`);
    return {
      bank: row.bank,
      t,
      rate: row.rate === '' ? null : Number(row.rate),
      change: row.change_bp === '' ? null : Number(row.change_bp),
    };
  });
}

/** Reads the events of IRD's calendar.ics: bank (from the UID), time and whether the date is tentative. */
export function parseIcs(text) {
  const unfolded = text.replace(/\r/g, '').replace(/\n[ \t]/g, '');
  const out = [];
  for (const block of unfolded.split('BEGIN:VEVENT').slice(1)) {
    const body = block.split('END:VEVENT')[0];
    const get = (k) => (body.match(new RegExp(`^${k}(?:;[^:\\n]*)?:(.*)$`, 'm')) || [])[1]?.trim();
    const uid = get('UID');
    const start = get('DTSTART');
    if (!uid || !start) continue;
    const m = start.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
    if (!m) continue;
    out.push({
      bank: uid.split('-')[0],
      t: Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]),
      tentative: get('STATUS') === 'TENTATIVE',
    });
  }
  return out;
}

const day = (t) => new Date(t).toISOString().slice(0, 10);

/**
 * Every bank's decisions to put in the script, oldest first.
 * Past: { kind: 'p', t, rate, change }. To come: { kind: 'u' | 't' (tentative), t, rate (the rate before), page }.
 */
export function buildEvents({ rows, next, ics = [], firstYear = FIRST_YEAR }) {
  const asOf = Date.parse(next.asOf);
  if (Number.isNaN(asOf)) throw new Error('next.json: no asOf');
  const from = Date.UTC(firstYear, 0, 1);
  const byBank = Object.fromEntries(BANKS.map((b) => [b.id, []]));
  const skipped = new Set();

  for (const r of rows) {
    if (!KNOWN.has(r.bank)) { skipped.add(r.bank); continue; }
    if (r.t < from || r.rate === null) continue;
    byBank[r.bank].push({ kind: 'p', t: r.t, rate: r.rate, change: r.change });
  }
  const pastDays = new Set(Object.entries(byBank).flatMap(([b, ev]) => ev.map((e) => `${b}:${day(e.t)}`)));
  const lastRate = (b) => byBank[b].filter((e) => e.kind === 'p').at(-1)?.rate ?? null;

  const upcoming = Object.fromEntries(BANKS.map((b) => [b.id, new Map()]));
  for (const d of [...(next.decisions || []), ...(next.justDecided || [])]) {
    if (!KNOWN.has(d.bank)) { skipped.add(d.bank); continue; }
    const t = Date.parse(d.t);
    if (Number.isNaN(t) || pastDays.has(`${d.bank}:${day(t)}`)) continue;
    upcoming[d.bank].set(day(t), {
      kind: d.tentative ? 't' : 'u',
      t,
      rate: typeof d.rateBefore === 'number' ? d.rateBefore : lastRate(d.bank),
      page: d.page || (d.path ? SITE + d.path : null),
    });
  }
  // The calendar adds the dates beyond next.json's window.
  for (const e of ics) {
    if (!KNOWN.has(e.bank) || e.t <= asOf) continue;
    const key = day(e.t);
    if (pastDays.has(`${e.bank}:${key}`) || upcoming[e.bank].has(key)) continue;
    const before = [...upcoming[e.bank].values()].filter((u) => u.t < e.t).sort((a, b) => a.t - b.t).at(-1);
    upcoming[e.bank].set(key, { kind: e.tentative ? 't' : 'u', t: e.t, rate: before?.rate ?? lastRate(e.bank), page: null });
  }
  for (const b of BANKS) {
    byBank[b.id].push(...upcoming[b.id].values());
    byBank[b.id].sort((x, y) => x.t - y.t);
  }
  return { byBank, asOf, skipped: [...skipped] };
}

/** One bank's events as the script reads them: "kind,unixSeconds,ratex100,changeBp" joined by ";". */
export function encodeBank(events) {
  return events
    .map((e) => [e.kind, Math.round(e.t / 1000), e.rate === null ? '' : Math.round(e.rate * 100), e.kind === 'p' && e.change !== null ? e.change : ''].join(','))
    .join(';');
}

/** The constants that replace {{DATA}} in the template. */
export function dataBlock({ byBank, asOf }, firstYear = FIRST_YEAR) {
  const lines = [
    `const string DATA_AS_OF = "${day(asOf)}"`,
    `const int FIRST_YEAR = ${firstYear}`,
    `const string DATA_FROM = "1 January ${firstYear}"`,
    `const int MAX_YEARS = ${new Date(asOf).getUTCFullYear() - firstYear + 1}`,
  ];
  for (const b of BANKS) {
    const s = encodeBank(byBank[b.id]);
    if (s.length > MAX_BANK_CHARS) throw new Error(`${b.id}: ${s.length} characters, over ${MAX_BANK_CHARS}: raise FIRST_YEAR`);
    if (!/^[ptu0-9,;\-]*$/.test(s)) throw new Error(`${b.id}: unexpected characters in the data`);
    lines.push(`const string D_${b.id.toUpperCase()} = "${s}"`);
  }
  return lines.join('\n');
}

export function renderPine(template, built, firstYear = FIRST_YEAR) {
  if (!template.includes('{{DATA}}')) throw new Error('template: no {{DATA}}');
  return template.replace('{{DATA}}', dataBlock(built, firstYear));
}

const fmtRate = (r, bank) => (r === null ? '' : bank === 'fed' ? `${(r - 0.25).toFixed(2)}–${r.toFixed(2)}%` : `${r.toFixed(2)}%`);

/** The README's table of the decisions to come, each linked to its page on IRD. */
export function nextTable({ byBank, asOf }, limit = 12) {
  const rows = BANKS.flatMap((b) => byBank[b.id].filter((e) => e.kind !== 'p' && e.t > asOf).map((e) => ({ ...e, bank: b })))
    .sort((x, y) => x.t - y.t)
    .slice(0, limit);
  const out = [
    `As of ${day(asOf)}. Times in UTC; the indicator shows them with a countdown.`,
    '',
    '| Decision | Time (UTC) | Rate before |',
    '| --- | --- | --- |',
  ];
  for (const e of rows) {
    const label = `${e.bank.short} ${new Date(e.t).toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })}`;
    const link = e.page ? `[${label}](${e.page}?via=${VIA})` : label;
    const when = new Date(e.t).toISOString().slice(0, 16).replace('T', ' ') + (e.kind === 't' ? ' (provisional)' : '');
    out.push(`| ${link} | ${when} | ${fmtRate(e.rate, e.bank.id)} |`);
  }
  out.push('', `Every date: [the central bank calendar](${SITE}/calendar/?via=${VIA}).`);
  return out.join('\n');
}

export function renderReadme(readme, built) {
  const re = /<!-- next:start -->[\s\S]*?<!-- next:end -->/;
  if (!re.test(readme)) throw new Error('README.md: no <!-- next:start --> / <!-- next:end --> markers');
  return readme.replace(re, () => `<!-- next:start -->\n${nextTable(built)}\n<!-- next:end -->`);
}

/** The same text without its "as of" dates, so a refresh that changed nothing else writes nothing. */
export const withoutAsOf = (s) => s.replace(/DATA_AS_OF = "[^"]*"/, '').replace(/^As of \d{4}-\d{2}-\d{2}\./m, '');

async function load(offline) {
  if (offline) {
    const read = (f) => readFile(path.join(offline, f), 'utf8');
    const icsPath = path.join(offline, 'calendar.ics');
    return {
      csv: await read('decisions.csv'),
      next: JSON.parse(await read('next.json')),
      ics: existsSync(icsPath) ? await readFile(icsPath, 'utf8') : '',
    };
  }
  const get = async (p) => {
    const res = await fetch(SITE + p, { headers: { 'user-agent': 'tradingview-central-bank-decisions generator' } });
    if (!res.ok) throw new Error(`${p}: HTTP ${res.status}`);
    return res.text();
  };
  const [csv, next] = await Promise.all([get('/data/decisions.csv'), get('/data/next.json')]);
  let ics = '';
  try { ics = await get('/calendar.ics'); } catch (e) { console.warn(`calendar.ics: ${e.message}; only next.json's dates are used`); }
  return { csv, next: JSON.parse(next), ics };
}

async function main(argv) {
  const offline = argv.includes('--offline') ? argv[argv.indexOf('--offline') + 1] : null;
  const check = argv.includes('--check');
  const { csv, next, ics } = await load(offline);
  const built = buildEvents({ rows: parseCsv(csv), next, ics: parseIcs(ics) });
  if (built.skipped.length) console.warn(`Not in the script (no bank entry): ${built.skipped.join(', ')}`);
  for (const b of BANKS) if (!built.byBank[b.id].some((e) => e.kind === 'p')) throw new Error(`${b.id}: no decision since ${FIRST_YEAR}: is the feed broken?`);

  const outputs = [
    [path.join(ROOT, 'central-bank-decisions.pine'), renderPine(await readFile(path.join(ROOT, 'src/template.pine'), 'utf8'), built)],
    [path.join(ROOT, 'README.md'), renderReadme(await readFile(path.join(ROOT, 'README.md'), 'utf8'), built)],
  ];
  let stale = false;
  for (const [file, text] of outputs) {
    const old = existsSync(file) ? await readFile(file, 'utf8') : '';
    if (withoutAsOf(old) === withoutAsOf(text)) { console.log(`${path.relative(ROOT, file)}: unchanged`); continue; }
    stale = true;
    if (!check) { await writeFile(file, text); console.log(`${path.relative(ROOT, file)}: written`); }
  }
  const counts = BANKS.map((b) => `${b.id} ${built.byBank[b.id].filter((e) => e.kind === 'p').length}+${built.byBank[b.id].filter((e) => e.kind !== 'p').length}`);
  console.log(`Decisions since ${FIRST_YEAR} (past+to come): ${counts.join(', ')}`);
  if (check && stale) { console.error('Out of date: run node scripts/generate.mjs'); process.exit(1); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((e) => { console.error(e.message); process.exit(1); });
}
