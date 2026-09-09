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
| `js/sky.js` | Canvas background: stars, moon, horizon, fireflies. Reads the current state. |
| `js/scenes.js` | The pinned intro: five scenes cross-faded by scroll progress, plus the routing-network and fee-split canvases. |
| `js/site.js` | Page wiring: status, countdowns, schedule strip and dial, pools table, stats, chart, buyback log, quote drawer, menu. |
| `data/nests.example.json` | The shape of the live data file. |
| `assets/favicon.svg` | Favicon. |
| `assets/og.png` | 1200×630 social card. |

## Intro scenes

The top of the page is a sticky stage. Five scenes cross-fade as the visitor scrolls about five screens, then the
page releases into the Now block, Stats, Mechanism, Pools, Buybacks, Token, Glossary. Dots on the right jump between
scenes. Under `prefers-reduced-motion` the scenes stack as normal sections.

| Scene | Copy | Artwork |
|---|---|---|
| 1 | OWL is a liquidity hub for tokenized stocks on Robinhood Chain. | Owl perched on a branch against a full moon (SVG, live eyes) |
| 2 | Every stock token is paired with OWL. A swap between two stocks routes through two OWL pools. | Ticker nodes linked to the OWL node; swaps pulse ticker → OWL → ticker (canvas) |
| 3 | One Uniswap v4 hook sets the fee from the NYSE calendar… | The 24-hour fee dial at full size (SVG, live hand) |
| 4 | Every fee splits 70% / 20% / 10%… | Fee particles flowing into three bins (canvas) |
| 5 | OWL IS … · Markets sleep. OWL hunts. | Close-up owl with the live status headline (SVG) |

### Replacing scene art with illustrations

The vector and canvas art can be swapped for painted illustrations per scene. Add an `<img>` inside the scene's
`.scene-art` (or set it as a CSS background on that element) and remove the SVG or canvas. Art direction that matches
the page:

- Palette: night ink `#06080F`, moonlight `#E9E5D8`, owl amber `#F5B942`. No other saturated hues.
- Style: nocturnal, quiet, illustrated rather than photographic. Deep shadows, amber light sources only (eyes, fireflies, moon reflections).
- Scene 1: an owl on a bare branch in front of a full moon, pines below, fireflies. Eyes must stay visible so the live-eye overlay can sit on top.
- Scene 2: a constellation or mycelium-like network of amber nodes converging on one point.
- Scene 3: a large ring or dial, four segments, one lit.
- Scene 4: a stream of light splitting into three unequal channels.
- Scene 5: the owl's face, close, eyes open.
- Deliver at 2000 px on the long edge, PNG with transparency where the sky should show through.

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
