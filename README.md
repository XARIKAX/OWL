# OWL — the website

Static site for **$OWL**, the time-aware liquidity hub for tokenized equities on Robinhood Chain.
The site runs on the same clock as the fee hook: while the NYSE is open the owl sleeps and the fee
reads 0.05%; when it closes the eyes open, the sky fills with fireflies, the status flips, and the fee climbs.

No build step. No dependencies. Open `index.html` or drop the folder on any static host.

## Files

| Path | What it is |
|---|---|
| `index.html` | The page: hero, thesis, mechanism, nests, stats, the hunt, token, lore, fee-quote drawer. |
| `css/styles.css` | Night ink / moonlight / owl amber. One theme. |
| `js/owl-clock.js` | The clock. NYSE calendar → one of four states. Also runs in Node. |
| `js/data.js` | Nests, stats, and the hunt log. Loads `data/nests.json` when present, otherwise generates a marked sample dataset from the fee model. |
| `js/sky.js` | The night behind the page: stars, fireflies, pine horizon, moon. One fixed canvas, driven by the state. |
| `js/site.js` | Wires everything: status and countdowns, the 24h dial, the week strip, the nests table, stats tiles and the 168-hour fee chart, the hunt log, the quote drawer, preview mode, the owl's eyes. |
| `data/nests.example.json` | The shape live data should take. |
| `assets/favicon.svg` | Two eyes that never close. |
| `assets/og.png` | 1200×630 social card. |

## The clock

All times Eastern. Decided by the NYSE calendar, nothing else.

| State | When | Fee |
|---|---|---|
| Asleep | Mon–Fri 9:30–16:00 (13:00 on early-close days) | 0.05% |
| Stirring | 4:00–9:30 and 16:00–20:00 (13:00–17:00 on early-close days) | 0.30% |
| Awake | 20:00–4:00 between two trading days | 0.60% |
| Hunting | From the last after-hours close to the next pre-market open across weekends and NYSE holidays | 1.00% |

Holidays are computed from the NYSE rules for any year (New Year's Day, MLK Day, Washington's Birthday,
Good Friday, Memorial Day, Juneteenth, Independence Day, Labor Day, Thanksgiving, Christmas, with the
Saturday→Friday / Sunday→Monday observance rules and the no-observance rule for a Saturday New Year's Day).
Early closes: July 3 when it is a weekday, the day after Thanksgiving, and Christmas Eve when it is a weekday.

Unscheduled closures (a national day of mourning, for example) go in `EXTRA_CLOSURES` at the top of
`js/owl-clock.js` as `'YYYY-MM-DD': 'Reason'`.

Time comes from the visitor's device clock, converted to Eastern with `Intl`. The hook reads block time; the
two can differ by seconds, never by state for long.

## Data: sample now, live at launch

Nests, stats, and the hunt log are rendered from whatever `js/data.js` loads:

1. `data/nests.json`, if it exists. Publish it in the shape of `data/nests.example.json` with `"sample": false`
   and every "Sample data" badge disappears. Refresh it on whatever cadence the indexer runs.
2. Otherwise a deterministic sample dataset generated from the fee model, and the page shows "Sample data"
   badges on every surface that uses it. The model assumes relative hourly volume of
   asleep 1.00 · stirring 0.55 · awake 0.35 · hunting 0.25 and prices each hour at that state's fee.

The 168-hour "Where the fees come from" chart and the per-nest fee split are always computed from the
current week's calendar, so holidays and early closes show up in the shape of the week.

## Interactive pieces

- **Fee quote drawer** (Buy OWL, Get a fee quote, Fee quote on a nest): prices a swap at the live rate and at
  all four states, and says what the same swap pays after the next change. The "Provide liquidity" tab computes
  a deposit's share of a nest and 70% of that nest's trailing 7-day fees at that share. Execution buttons are
  disabled until launch.
- **Nests table**: sort by any column, search by ticker or name, click a row for its fee split, 24h volume, and actions.
- **State table**: click a row to preview that state across the whole page. The clock keeps running underneath.
- **24h dial and week strip**: hover for the fee of any hour.

## Preview and testing

Query parameters, useful for screenshots and demos:

- `?state=hunting` — show a state (`asleep`, `stirring`, `awake`, `hunting`). Marked as a preview.
- `?at=2026-09-11T20:00:00-04:00` — run the live clock from that moment.

## Before launch

- Social links (X, Telegram, Docs) in the nav, the mobile menu, and the footer point at `#`. Set them.
- Set `og:image` and `twitter:image` to absolute URLs once the domain exists. The card is `assets/og.png`.
- The contract row in the token table reads "Published at launch". Replace it with the address and an explorer link.
- Wire the swap and liquidity buttons in the drawer to the DEX once nests are live.
- Publish `data/nests.json` from the indexer.

## Deploy

Any static host. For GitHub Pages: Settings → Pages → deploy from branch, root folder. `.nojekyll` is included so
the folder ships as-is. For Vercel or Netlify: import the repo, no build command, output directory `.`.
