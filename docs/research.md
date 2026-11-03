# Research: how the data gets to TradingView, and what a publication may say

Checked on 2 November 2026.

## 1. Can Pine Seeds host the data instead of arrays in the script?

**No, not for a new project.** TradingView's official Pine Seeds documentation carries the notice: "The creation of new repositories has been suspended." It adds: "We will continue to support the existing repositories", with questions to pine.seeds@tradingview.com. There is a form to register interest if the service reopens. No date is given for either.

Even if it reopened, Pine Seeds would be a poor fit here:

- data on it "can only be updated 5 times per day";
- "only daily-based timeframes (1D and above) can be applied to such data", so an intraday chart, where a decision matters most, could not read it;
- it carries series of values per day (OHLCV-like), not a list of future events with times.

**What we do instead (as the plan proposed):** the decisions are written into the script as one string per bank, a GitHub Action regenerates the file every day from InterestRateDecision.com's open data, and the owner republishes on TradingView once a month (TradingView has no publishing API). Between republishes the published copy keeps working: the dates of the next three months to a year are already in it (from `next.json` and `calendar.ics`), and a decision that passes before the next update is labelled "Decided" without a result, never with a guessed one.

If Pine Seeds reopens, revisit: it could carry each bank's rate as a daily series (`request.seed`), but the event times would still need the arrays.

Sources:

- TradingView, Pine Seeds docs (official): https://github.com/tradingview-pine-seeds/docs
- The same docs, UI page: https://github.com/tradingview-pine-seeds/docs/blob/main/ui.md
- An older third-party copy without the suspension notice (out of date): https://github.com/mksamanes/pine-seeds-docs

## 2. Pine Script limits we must stay within

From TradingView's "Limitations" page (Pine v6):

- 100,256 compiled tokens per script; 5 MB per compilation request.
- 100,000 elements per collection (array, matrix); maps 50,000 pairs.
- At most 500 label IDs and 500 line IDs (`max_labels_count`, `max_lines_count`).
- 1,000 variables per scope; 20 s (basic) or 40 s execution across all bars.

How the script stays inside them:

- **History from 1 January 2020** (`FIRST_YEAR` in `scripts/generate.mjs`): about 520 past decisions of the ten banks plus about 75 to come (November 2026). Each bank's decisions are one string literal (one token), parsed once on the first bar; the generated file is about 25 KB.
- The generator refuses a bank string over 4,000 characters (`MAX_BANK_CHARS`): if that ever trips, raise `FIRST_YEAR` rather than split strings.
- Labels: with two banks and the default three years, about 50 labels; the most a chart can show (ten banks, every year) is under 500.

Source: https://www.tradingview.com/pine-script-docs/writing/limitations/

## 3. TradingView's House Rules and Script Publishing Rules on links and promotion

What the rules say (quoted from the Script Publishing Rules):

- "do not use your script's description, release notes, title, chart, or code to share links or references to social media", nor "contact information, payment details, or other forms of advertisement."
- "Do not solicit users to follow or message you, or to boost and comment on your publications."
- "Do not publish scripts that serve no purpose other than to direct users to your content."
- "Users should be able to understand all key information about your script solely by reading your description." (No "see the link for details".)
- "Include an English explanation of your script at the beginning of the description." Titles in English, 7-bit ASCII.
- "Ensure that your script is original and potentially useful for the community", and say why in the description.
- Charts: "publish with a clean chart that is easy to read": no extra scripts or drawings without a reason, no hidden status lines.
- Performance: "If you cannot substantiate a claim, it does not belong in your publication."

The House Rules (rule 2, "All content should be ad-free") add that the ban "covers: all advertisements, logos, links or references to any website, social media, messaging or email contacts" and "company names, wallet addresses, giveaways, prize contests or any other kind of announcement or solicitation", and that "content" includes "scripts, open-source code, script release notes". **The only exception is for Premium subscribers**, "allowed to include contacts, links, and solicitation in their Signature field", which "appears under every published idea or script". Rule 4: titles in English, descriptions beginning in English.

**Vendors:** "If you provide paid access to scripts or sell services/products to traders outside the TradingView platform" you are "considered a Vendor" and must meet the Vendor Requirements. InterestRateDecision.com sells nothing, but it belongs to Forexia, which sells courses and a signals membership. Keep the publishing profile and its signature on InterestRateDecision.com's free pages only (calendar, decision pages, data); do not link Forexia's paid products from the TradingView profile, or the profile may be treated as a vendor's.

**What we do:**

| Place | Links and names |
| --- | --- |
| Script code (`src/template.pine`) | No URL, no domain, no handle, no contact. A test (`tests/generate.test.mjs`) fails if one appears. |
| Publication title | "Central Bank Decisions" (ASCII, English). |
| Publication description (`docs/tradingview-description.md`) | Explains what the script does and why it is useful, self-contained. No link, no website name, no call to follow or boost, no performance claim. The data source is described ("compiled from each central bank's own announcements") without naming the site. |
| Chart of the publication | One script (this one) on a clean EURUSD chart. |
| Release notes | Only "Data updated to <date>" and what changed in the script. |
| Profile signature (Premium only) | The links to InterestRateDecision.com's calendar and decision pages, with `?via=tv-decisions`. Without Premium, no link anywhere on TradingView: the repository carries them. |
| GitHub repository README | Every link (calendar, decision pages, data, licence), with `?via=tv-decisions`. |

**On the data licence:** InterestRateDecision.com's data is "free with a link". The publication cannot carry the link, so it is published from InterestRateDecision.com's own TradingView profile: the owner of the data is the publisher, and the profile and the repository carry the link. Anyone else reusing the generated script elsewhere follows the licence in the README.

**Open-source reuse:** no third-party code is reused, so no credit is owed; the script is published open source (MIT) so others can reuse it.

Sources:

- Script Publishing Rules: https://www.tradingview.com/support/solutions/43000590599-script-publishing-rules/
- House Rules: https://www.tradingview.com/house-rules/
- Our House rules (help centre): https://in.tradingview.com/support/solutions/43000591638
- Vendor Requirements (invite-only scripts; not this one, for comparison): https://in.tradingview.com/support/solutions/43000549951-vendor-requirements/
- Publishing scripts (Pine docs): https://www.tradingview.com/pine-script-docs/v5/writing/publishing/

## 4. Not checked, left for the owner

- **The Pine compiler.** There is no offline Pine compiler; the template was written against the v6 reference but has not been compiled. Paste it into the Pine Editor once before the first publication (docs/republish.md, step 2) and fix any error there in `src/template.pine`.
- Whether the moderators accept a monthly update as a release, rather than a new publication: updates to the same publication are the documented way ("Update existing script"), so a new publication each month must not be made (it would be spam).
