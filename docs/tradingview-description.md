# The TradingView publication

Paste these into TradingView's "Publish script" form. They follow the House Rules and Script Publishing Rules (docs/research.md, section 3): no links, no website or company names, no contact, no request to follow or boost, no performance claim, English first, and enough to understand the script without reading anything else. Keep them that way when you edit them.

**Title** (ASCII, English):

```
Central Bank Decisions
```

**Category**: Indicators. **Tags**: central banks, interest rates, fomc, ecb, news, calendar, fundamentals. **Visibility**: public, open source.

**Chart for the publication**: EURUSD, 4 hours, this script only, default settings, about six months visible so that past labels and the next ECB and Fed countdowns both show. No other drawings.

**Description** (paste between the lines):

---

Central Bank Decisions marks the interest rate decisions of the central banks behind the chart's two currencies, right on the price chart.

On EURUSD it shows the European Central Bank and the Federal Reserve; on USDJPY the Federal Reserve and the Bank of Japan; on gold or a US index, the Federal Reserve. Ten banks are covered: the Federal Reserve (USD), European Central Bank (EUR), Bank of England (GBP), Bank of Japan (JPY), Bank of Canada (CAD), Reserve Bank of Australia (AUD), Reserve Bank of New Zealand (NZD), Swiss National Bank (CHF), Norges Bank (NOK) and Sveriges Riksbank (SEK).

WHAT IT DRAWS

- Past decisions: a label on the bar where each decision was announced, with the result (hike, hold or cut), the size of the move in basis points and the new rate. Hikes, cuts and holds have their own colours. The base currency's bank is labelled above the bars and the quote currency's below, so the two never get mixed up.
- Decisions to come: a label at the announcement time with a countdown ("in 5d 3h"), and a dashed vertical line, so you can see how far away the next decision is on any timeframe.
- A table with each bank's current rate, the date and time of its next decision in UTC, and the countdown.
- Hover any label for the bank's full name, the exact time in UTC and the result in words.
- An alert condition, "Decision within the hour", for the chart's banks.

WHY IT IS USEFUL

Rate decisions are scheduled events that can move a currency sharply, before and after the announcement. Most calendars live outside the chart; this one puts the dates, the results and the time left where you are already looking, and only for the two currencies you are trading. Looking back, it shows at a glance how price behaved around each past decision of those banks.

SETTINGS

- Banks to show: the chart's two currencies (default), or every bank you tick.
- A tick per bank, to hide one in either mode.
- Past years of decisions (0 to show only the decisions to come).
- How many decisions to come per bank, vertical lines, the table and its position, label size.
- Colours for hikes, cuts, holds, decisions to come and label text.

THE DATA, AND ITS LIMITS

Pine Script cannot download data, so the decisions are written into the script: the time of each announcement, the rate after it and the change in basis points, compiled from each central bank's own announcements. The history starts in January 2020, to keep the script light; the dates of the months ahead are included as each bank publishes them.

- The script is updated about once a month with the latest results and dates. A decision that has happened since the last update is labelled "Decided" without a result, and the table says "update" when a bank has no date to come. The table shows the date of the data.
- The Federal Reserve's rate is its target range, shown with both ends. The Bank of Japan sets no fixed hour; its times are estimates and are marked provisional, as are other dates a bank has not confirmed.
- Rate decisions only: no inflation, jobs or other releases.
- Times are the announcement times in UTC; labels are placed on the bar that contains the announcement, or the first bar after it if the market was closed.

This indicator shows what central banks decided and when they decide next. It does not forecast decisions or price moves, and it is not a trading signal.

---

**Release note for the monthly update** (the only text a monthly update needs):

```
Data updated to <DATA_AS_OF from the script>: new results and the dates of the months ahead.
```

When the script itself changes, add one line saying what changed, in the same plain style.
