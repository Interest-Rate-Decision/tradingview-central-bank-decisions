// The generator's tests: offline, from tests/fixtures/. Run: node --test tests/generate.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, copyFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BANKS, FIRST_YEAR, MAX_BANK_CHARS, parseCsv, parseIcs, buildEvents, encodeBank, dataBlock,
  renderPine, nextTable, renderReadme, withoutAsOf,
} from '../scripts/generate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIX = path.join(ROOT, 'tests/fixtures');
const read = (f) => readFile(path.join(FIX, f), 'utf8');

async function built() {
  return buildEvents({ rows: parseCsv(await read('decisions.csv')), next: JSON.parse(await read('next.json')), ics: parseIcs(await read('calendar.ics')) });
}

test('parseCsv reads the rows, with blank rates as null', async () => {
  const rows = parseCsv(await read('decisions.csv'));
  assert.equal(rows.length, 15);
  assert.deepEqual(rows[1], { bank: 'fed', t: Date.UTC(2020, 2, 3, 15), rate: 1.25, change: -50 });
  assert.equal(rows.find((r) => r.bank === 'ecb').rate, null);
});

test('parseCsv fails loudly when a column is missing', () => {
  assert.throws(() => parseCsv('bank,time_utc,rate\nfed,2020-01-01T00:00:00Z,1\n'), /change_bp/);
  assert.throws(() => parseCsv('bank,time_utc,rate,change_bp\nfed,soon,1,0\n'), /bad time/);
});

test('parseIcs unfolds lines and reads bank, time and status', async () => {
  const ev = parseIcs(await read('calendar.ics'));
  assert.equal(ev.length, 5);
  assert.deepEqual(ev[2], { bank: 'fed', t: Date.UTC(2027, 0, 27, 19), tentative: false });
  assert.equal(ev.find((e) => e.bank === 'boj').tentative, true);
});

test('buildEvents keeps the history from FIRST_YEAR and skips unknown banks', async () => {
  const b = await built();
  const fed = b.byBank.fed;
  assert.equal(fed.filter((e) => e.kind === 'p').length, 3, 'the 2019 decision is dropped');
  assert.ok(fed.every((e, i) => i === 0 || e.t >= fed[i - 1].t), 'oldest first');
  assert.equal(b.byBank.ecb.filter((e) => e.kind === 'p').length, 1, 'the 2015 row and its blank rate are dropped');
  assert.deepEqual(b.skipped, ['rbi']);
});

test('buildEvents merges next.json and the calendar without duplicates', async () => {
  const fed = (await built()).byBank.fed.filter((e) => e.kind !== 'p');
  // 28 October is already a result in the CSV; 9 December is in both next.json and the calendar.
  assert.deepEqual(fed.map((e) => new Date(e.t).toISOString().slice(0, 10)), ['2026-12-09', '2027-01-27']);
  assert.equal(fed[0].page, 'https://interestratedecision.com/fed/december-2026/');
  assert.equal(fed[1].page, null);
  assert.equal(fed[1].rate, 4, "a calendar-only date carries the rate before it");
});

test('buildEvents marks provisional dates and fills the rate from the last result', async () => {
  const b = await built();
  const boj = b.byBank.boj.filter((e) => e.kind !== 'p');
  assert.deepEqual(boj.map((e) => e.kind), ['t', 't']);
  const ecb = b.byBank.ecb.filter((e) => e.kind !== 'p');
  assert.equal(ecb.length, 1);
  assert.equal(ecb[0].rate, 2.5);
});

test('encodeBank writes kind, seconds, rate x100 and change', () => {
  const s = encodeBank([
    { kind: 'p', t: Date.UTC(2020, 2, 3, 15), rate: 1.25, change: -50 },
    { kind: 'p', t: Date.UTC(2020, 2, 15, 21), rate: -0.1, change: 0 },
    { kind: 'u', t: Date.UTC(2026, 11, 9, 19), rate: 4, change: null },
  ]);
  assert.equal(s, 'p,1583247600,125,-50;p,1584306000,-10,0;u,1796842800,400,');
});

test('dataBlock declares every bank and refuses a string that is too long', async () => {
  const b = await built();
  const block = dataBlock(b);
  for (const bank of BANKS) assert.match(block, new RegExp(`^const string D_${bank.id.toUpperCase()} = "`, 'm'));
  assert.match(block, /^const string DATA_AS_OF = "2026-11-01"$/m);
  assert.match(block, new RegExp(`^const int MAX_YEARS = ${2026 - FIRST_YEAR + 1}$`, 'm'));
  const many = Array.from({ length: MAX_BANK_CHARS / 10 }, (_, i) => ({ kind: 'p', t: Date.UTC(2020, 0, 1) + i * 864e5, rate: 1, change: 0 }));
  assert.throws(() => dataBlock({ ...b, byBank: { ...b.byBank, fed: many } }), /raise FIRST_YEAR/);
});

test('the template uses every generated constant and keeps the banks in order', async () => {
  const template = await readFile(path.join(ROOT, 'src/template.pine'), 'utf8');
  const pine = renderPine(template, await built());
  assert.ok(!pine.includes('{{'), 'no placeholder left');
  assert.match(pine, /^\/\/@version=6$/m);
  const shorts = pine.match(/BANK_SHORT = array\.from\(([^)]*)\)/)[1].split(',').map((s) => s.trim().replace(/"/g, ''));
  assert.deepEqual(shorts, BANKS.map((b) => b.short));
  const ccys = pine.match(/BANK_CCY = array\.from\(([^)]*)\)/)[1].split(',').map((s) => s.trim().replace(/"/g, ''));
  assert.deepEqual(ccys, BANKS.map((b) => b.ccy));
  const data = pine.match(/BANK_DATA = array\.from\(([^)]*)\)/)[1].split(',').map((s) => s.trim());
  assert.deepEqual(data, BANKS.map((b) => `D_${b.id.toUpperCase()}`));
  for (const c of ['DATA_AS_OF', 'DATA_FROM', 'MAX_YEARS']) assert.ok(pine.split(c).length > 2, `${c} is used`);
});

test('no link, website or banned word in the script', async () => {
  const pine = await readFile(path.join(ROOT, 'src/template.pine'), 'utf8');
  assert.doesNotMatch(pine, /https?:|www\.|\.com\b|\.org\b|\.net\b|\w@\w|t\.me|telegram|discord/i);
  assert.ok(!/[^\x00-\x7f]/.test(pine), 'ASCII only');
  assert.ok(!pine.includes('\r'), 'LF line endings');
  for (const [i, line] of pine.split('\n').entries()) {
    const quotes = (line.replace(/\\"/g, '').match(/"/g) || []).length;
    assert.equal(quotes % 2, 0, `line ${i + 1}: a string is not closed on its line`);
  }
  assert.doesNotMatch(pine, /order block|fair value gap|\bfvg\b|kill zone|liquidity void|imbalance|inducement|displacement|break of structure|change of character|judas|silver bullet|\bsmc\b|\bict\b/i);
});

test('nextTable links each page with via and draws the Fed range', async () => {
  const table = nextTable(await built());
  assert.match(table, /^As of 2026-11-01\./);
  assert.match(table, /\[Fed December 2026\]\(https:\/\/interestratedecision\.com\/fed\/december-2026\/\?via=tv-decisions\) \| 2026-12-09 19:00 \| 3\.75–4\.00% \|/);
  assert.match(table, /BoJ December 2026\]\([^)]*\) \| 2026-12-18 03:00 \(provisional\)/);
  assert.match(table, /calendar\/\?via=tv-decisions/);
  assert.ok(table.indexOf('BoE November') < table.indexOf('Fed December'), 'soonest first');
});

test('renderReadme replaces only the marked section, and again the same way', async () => {
  const b = await built();
  const readme = 'Top\n\n<!-- next:start -->\nold\n<!-- next:end -->\n\nBottom\n';
  const once = renderReadme(readme, b);
  assert.equal(renderReadme(once, b), once);
  assert.ok(once.startsWith('Top\n\n<!-- next:start -->\nAs of') && once.endsWith('<!-- next:end -->\n\nBottom\n'));
  assert.throws(() => renderReadme('no markers', b), /markers/);
});

test('withoutAsOf ignores a refresh that changed only the date', () => {
  assert.equal(withoutAsOf('const string DATA_AS_OF = "2026-11-01"\nx'), withoutAsOf('const string DATA_AS_OF = "2026-11-02"\nx'));
  assert.notEqual(withoutAsOf('a\nAs of 2026-11-01. y'), withoutAsOf('a\nAs of 2026-11-02. z'));
});

test('the command line writes both files from the fixtures, then finds nothing to change', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'tv-decisions-'));
  for (const d of ['scripts', 'src']) await mkdir(path.join(dir, d));
  await copyFile(path.join(ROOT, 'scripts/generate.mjs'), path.join(dir, 'scripts/generate.mjs'));
  await copyFile(path.join(ROOT, 'src/template.pine'), path.join(dir, 'src/template.pine'));
  await writeFile(path.join(dir, 'README.md'), '# x\n<!-- next:start -->\n<!-- next:end -->\n');
  const run = (...args) => execFileSync(process.execPath, [path.join(dir, 'scripts/generate.mjs'), '--offline', FIX, ...args], { encoding: 'utf8', stdio: 'pipe' });
  assert.match(run(), /central-bank-decisions\.pine: written/);
  const pine = await readFile(path.join(dir, 'central-bank-decisions.pine'), 'utf8');
  assert.match(pine, /const string D_FED = "p,1583247600,125,-50;/);
  assert.match(run('--check'), /unchanged[\s\S]*unchanged/);
});
