# OWL — the website

Static site for **$OWL**, the time-aware liquidity hub for tokenized equities on Robinhood Chain.
The site runs on the same clock as the fee hook: while the NYSE is open the owl sleeps and the fee
reads 0.05%; when it closes the eyes open, the status flips, and the fee climbs.

No build step. No dependencies. Open `index.html` or drop the folder on any static host.

## Files

| Path | What it is |
|---|---|
| `index.html` | The page. |
| `css/styles.css` | Night ink / moonlight / owl amber. One theme. |
| `js/owl-clock.js` | The clock. NYSE calendar → one of four states. Also runs in Node. |
| `js/site.js` | Wires the clock to the page: status, fee, countdowns, the week strip, preview mode, the owl's eyes. |
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

## Preview and testing

Query parameters, useful for screenshots and demos:

- `?state=hunting` — show a state (`asleep`, `stirring`, `awake`, `hunting`). The page marks it as a preview; the clock keeps running underneath.
- `?at=2026-09-11T20:00:00-04:00` — run the live clock from that moment. Shows the exact copy, countdowns, and week strip a visitor would see then.

Clicking a row in the state table does the same as `?state=`.

## Before launch

- Footer links (`X`, `Telegram`, `Docs`) in `index.html` point at `#`. Set them.
- Set `og:image` and `twitter:image` to absolute URLs once the domain exists. The card is `assets/og.png`.
- The contract row in the token table reads "Published at launch". Replace it with the address and an explorer link.

## Deploy

Any static host. For GitHub Pages: Settings → Pages → deploy from branch, root folder. `.nojekyll` is included so
the folder ships as-is. For Vercel or Netlify: import the repo, no build command, output directory `.`.
