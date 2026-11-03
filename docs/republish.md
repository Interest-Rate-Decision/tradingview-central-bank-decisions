# Republishing on TradingView

TradingView has no publishing API, so the owner updates the publication by hand. The GitHub Action keeps `central-bank-decisions.pine` current every day and opens an issue on the 1st of each month as a reminder.

## Every month (five minutes)

1. **Open the generated file** on GitHub: `central-bank-decisions.pine` on `main`, then "Raw", and copy all of it. (The Action has already regenerated it; to do it yourself: `node scripts/generate.mjs`.)
2. **Open the published script** on TradingView, signed in to InterestRateDecision.com's profile: Pine Editor, "Open", "My scripts", "Central Bank Decisions". Select all, paste, Save. If the editor shows an error, stop: fix it in `src/template.pine`, regenerate, and start again.
3. **Check one chart**: EURUSD, 4 hours. Past ECB labels above the bars and Fed labels below, the countdown labels to the right of the last bar, and the table's "Data as of" showing the date in the script's `DATA_AS_OF`.
4. **Publish the update**: "Publish script", choose "Update existing script" (never a new publication: a copy each month would be spam), and paste the release note from `docs/tradingview-description.md`:
   `Data updated to <DATA_AS_OF>: new results and the dates of the months ahead.`
5. **Close the month's issue** on GitHub.

## The first time only

1. **Profile**: the TradingView profile is InterestRateDecision.com's (the data's owner), not Forexia's, so the data licence's link is on the profile and nothing on TradingView points at paid products (docs/research.md, "Vendors").
2. **Compile**: paste the script into a new Pine Editor tab and "Add to chart". No offline Pine compiler exists, so this is the first real compile; fix any error in `src/template.pine` and regenerate.
3. **Publish**: "Publish script", public, open source, with the title, category, tags and description in `docs/tradingview-description.md`, on the clean chart it describes.
4. **Signature** (Premium only, the one place a link is allowed): `Calendar of every central bank decision: https://interestratedecision.com/calendar/?via=tv-decisions`. Without Premium, leave links out: the repository carries them.
5. **Repository**: add the publication's TradingView address to the README's "Use it" section, so readers of the repository can add it in one click.
6. **Screenshot**: save the publication's chart as `docs/screenshot.png` (1600 px wide or so) for the README.

## When something is wrong

- A wrong date or rate comes from the data, not the script: fix it at the source (InterestRateDecision.com's corrections), then regenerate.
- The Action failed: the run's log says which file could not be read or which check refused the data. Nothing is committed when it fails, so the last good copy stays.
- A bank string grew past 4,000 characters: raise `FIRST_YEAR` in `scripts/generate.mjs`, update the README and the description, and republish.
