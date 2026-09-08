# OWL — website

Static site for **$OWL**, a liquidity hub for tokenized equities on Robinhood Chain. A Uniswap v4 hook
sets each pool's fee from the NYSE calendar. The site runs the same calendar in the browser: the status,
fee, countdowns, schedule, and the owl update every second in Eastern time.

No build step. No dependencies. Serve the folder from any static host, or open `index.html` directly.

## Files

| Path | What it is |
|---|---|
| `index.html` | The page. |
| `css/styles.css` | Styles. One theme. |
| `js/owl-clock.js` | NYSE calendar → one of four fee states. Also runs in Node. |
| `js/data.js` | Pools, stats, and buyback data. Loads `data/nests.json` when present, otherwise generates a sample dataset from the fee model. |
| `js/sky.js` | Canvas background: stars, horizon, fireflies. Reads the current state. |
| `js/site.js` | Page wiring: status, countdowns, schedule strip and dial, pools table, stats, chart, buyback log, quote drawer, menu. |
| `data/nests.example.json` | The shape of the live data file. |
| `assets/favicon.svg` | Favicon. |
| `assets/og.png` | 1200×630 social card. |

## Fee states

All times Eastern. Decided by the NYSE calendar only.

| State | When | Fee |
|---|---|---|
| Asleep | Mon–Fri 9:30–16:00 (13:00 on early-close days) | 0.05% |
| Stirring | 4:00–9:30 and 16:00–20:00 (13:00–17:00 on early-close days) | 0.30% |
| Awake | 20:00–4:00 between two trading days | 0.60% |
| Hunting | From the last after-hours close to the next pre-market open, across weekends and NYSE holidays | 1.00% |

Holidays are computed from the NYSE rules for any year: New Year's Day, Martin Luther King Jr. Day, Washington's
Birthday, Good Friday, Memorial Day, Juneteenth, Independence Day, Labor Day, Thanksgiving, Christmas. Saturday
holidays are observed on Friday and Sunday holidays on Monday, except New Year's Day on a Saturday, which is not observed.
Early closes: July 3 when it is a weekday, the day after Thanksgiving, and Christmas Eve when it is a weekday.

Unscheduled closures go in `EXTRA_CLOSURES` at the top of `js/owl-clock.js` as `'YYYY-MM-DD': 'Reason'`.

Time comes from the visitor's device clock, converted to Eastern with `Intl`. The hook reads block time. The two
can differ by seconds.

## Data

Until launch, pools, stats, and the buyback log show a sample dataset generated in `js/data.js` from a seeded
model: relative volume per hour by state (asleep 1.00, stirring 0.55, awake 0.35, hunting 0.25) times the fee of
the hour. Every surface that shows it carries a "Sample data" badge.

To go live, publish `data/nests.json` in the shape of `data/nests.example.json` with `"sample": false`. The loader
prefers that file when it exists. Fields per pool: `ticker`, `name`, `pair`, `tvl`, `vol24h`, `fees24h`, `fees7d`,
`feesLifetime`, `lps`, and `hourly` (24 entries of `hour`, `state`, `volume`). Top level: `updated`, `priceUsd`,
`totals`, `buybacks` (`time`, `state`, `usd`, `owl`, optional `tx`), and `hunt` (`boughtUsd`, `boughtOwl`, `count`).

## Preview and testing

Query parameters:

- `?state=hunting` shows a state (`asleep`, `stirring`, `awake`, `hunting`). The page marks it as a preview. The clock keeps running underneath.
- `?at=2026-09-11T20:00:00-04:00` runs the live clock from that moment. Useful for screenshots and for checking copy at a given hour.

Clicking a row in the state table does the same as `?state=`.

The quote drawer prices a swap at the current state and at each of the four states, and computes an LP share for a
deposit against a pool's TVL. The swap and add-liquidity buttons are disabled until launch.

## Before launch

- Footer and nav links for X, Telegram, and Docs point at `#`. Set them.
- Set `og:image` and `twitter:image` to absolute URLs once the domain exists.
- Replace the "Published at launch" contract row with the address and an explorer link.
- Wire the drawer's swap and add-liquidity buttons to the DEX.
- Publish `data/nests.json` from your indexer.

## Deploy

Any static host. GitHub Pages: Settings → Pages → deploy from branch, root folder. `.nojekyll` is included.
Vercel or Netlify: import the repo, no build command, output directory `.`.
