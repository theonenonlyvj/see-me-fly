# Data-Viz Cards — Build & Replacement Tracker

**Goal:** build the 6 council-selected "data-is-beautiful" cards and wire them into the deck,
**additively** (insert new cards; do NOT delete any old card yet). This doc tracks each new card, the
old card(s) it is intended to replace, and the eventual cleanup pass.

Governed by [dataviz-lens.md](../dataviz-lens.md). Visual targets: the rendered mockups in
`.dataviz-mockups/` (gitignored, local). All new cards are `group: 'creative'`, additive to
`src/app/cards/registry.ts`.

## Conventions (all cards)
- A card is `export const xCard: CardDef = { id, title, group:'creative', accent, icon, render(ctx) }`.
- `ctx = { model, settings, overlay?, update? }`. `model.flown` = all-time filtered `EnrichedFlight[]`;
  `model.scoped` = year-scoped. Cards that portray the whole life (spiral, streamgraph, year-blooms,
  home&away) read **all-time** (`model.flown`); the rest may honor scope.
- Wrap in `CardFrame` (title/eyebrow/icon/accent). Viz is hand-built inline SVG (no new deps).
- Home-by-date: use `homeAt(date, settings)` / `isHomeOn` from `src/engine/home.ts` for era-correct color.
- **Truth rules from the lens:** label every scale; caption log/sqrt; count-honest marks (no area lies);
  flag reconstructed/estimated data.
- Tests: engine helpers get unit tests in `src/test/engine/`; a card smoke test asserts it renders.

## Shared helper (build in Task 1, reuse after)
`src/app/cards/_viz/polar.ts` — small pure helpers reused by the polar cards:
- `polar(cx, cy, r, angleDeg)` → `{x,y}` (0° = up/12-o'clock, clockwise)
- `dayOfYear(dateStr)` → 1..366 ; `monthOfYear(dateStr)` → 0..11
- `homeAccent(code)` → a stable Pop hue per home metro (for spiral/among home eras)

---

## The 6 cards (build order = simplest polar → complex)

### Task 1 — ⑥ Small-Multiple Year Blooms  (effort M)
- **id/title:** `yearBlooms` / "Small-Multiple Year Blooms". Icon 🌸, accent coral.
- **Encoding:** grid of small radial month-clocks, one per year. 12 short radial **bars** from center
  (Jan at 12 o'clock, clockwise); bar length = that month's flight count; **one shared radius scale**
  across all years so heavy years out-bloom light ones. Length-only bars (NOT filled wedges) to stay
  honest. Single accent (coral) per bloom; year numeral beneath.
- **Data:** `model.flown` → count by (year, month). New helper `flightsByYearMonth(flights)`.
- **Replaces (later):** net-new (seasonality). Complements Intensity; a candidate to absorb the
  monthly view.
- **Notes:** shared scale is the whole point. Faint 12-spoke guide ring behind each. Caption:
  "spoke length = flights that month; all clocks share one scale."

### Task 2 — ① 13 Years Aloft (spiral year-clock)  (effort L, HERO)
- **id/title:** `spiralAloft` / "13 Years Aloft". Icon 🌀, accent = hero gradient. `fullWidth` OK.
- **Encoding:** Archimedean spiral; one thin radial arc-tick per non-local flight at
  (angle = day-of-year, radius = year-index ring). Stroke weight ∝ `log(distanceMi)`. Stroke COLOR =
  home-era active that date via `homeAt()` (so relocations appear as color bands migrating outward).
  Faint month spokes; year labels on the left spoke. Low-opacity hero-gradient wash beneath.
  **Exactly one** annotation: leader-line to the single busiest week.
- **Data:** `model.flown` (exclude `isLocalFlight`); `date`, `year`, `distanceMi`, `homeAt(date)`.
  New helper `busiestWeek(flights)`.
- **Replaces (later):** net-new hero (complements Career Arc / Intensity).
- **Notes:** count-honest ticks, NOT area-filled. Caption the log-distance weight + that inner rings
  crowd because early years hold fewer, tighter marks (per mockup).

### Task 3 — ③ The Body-Clock (24h dial)  (effort M)
- **id/title:** `bodyClock` / "The Body-Clock". Icon 🌓, accent indigo.
- **Encoding:** one 24h radial clock (midnight top, noon bottom). Each flown flight = one low-opacity
  thin arc from local departure hour → local arrival hour along the rim. Hue = direction of tz change
  from `depUtcMs/arrUtcMs` vs local hours: eastward (lose time) indigo/magenta, westward (gain time)
  sky/lime, same-zone ink-grey. Faint night terminator band (~21:00–06:00) behind arcs. Center: total
  flights. One annotation: the modal departure hour ("departed at 6am 84×").
- **Data:** `model.flown` → `depHourLocal`, `arrHourLocal`, `depUtcMs`, `arrUtcMs`, `durationMin`.
  New helper `tzDirection(f)` → 'east'|'west'|'same' (compare local elapsed vs true elapsed).
- **Replaces (later):** When You Fly + When-You-Fly overlay + Red-Eyes.
- **Notes:** per-arc opacity ~0.06 so overlap reads as tone. Caption east/west color meaning.

### Task 4 — ② Allegiance Streamgraph  (effort M)
- **id/title:** `allegiance` / "13 Years of Who Flew You". Icon 🌊, accent = per-carrier. `fullWidth`.
- **Encoding:** horizontal streamgraph; time L→R across all years; each of top ~6 carriers a smoothly
  interpolated band (thickness = flights that year), stacked inside-out around a center baseline;
  muted 'Other'. Labels ride the fattest part; legend for thin streams. Faint vertical hairline(s) at
  home-move dates. Faint per-year total ticks along the top keep magnitude honest.
- **Data:** `model.flown` → airline share by year (half-year buckets for smoothness). Reuse/extend
  `byAirline`; new helper `airlineByYear(flights, mergeDefunct)`.
- **Replaces (later):** **Career Arc + Airline Eras** (both StackedColumns — the council's #1 swap).
- **Notes:** smooth path (Catmull-Rom/basis), hand-rolled — no new dep. Caption "band thickness =
  flights that year; smoothed between years."

### Task 5 — ⑤ Home-Anchored Range Bloom  (effort M)
- **id/title:** `rangeBloom` / "Home-Anchored Range Bloom". Icon 🧭, accent indigo.
- **Encoding:** polar "radar sky". Home at center (hero-gradient glow). Faint concentric distance rings
  **labeled** 500/1k/3k/6k mi with N/E/S/W compass ticks. Each distinct destination a dot at its true
  initial-bearing + great-circle distance from the **era-correct** home; dot **sqrt-area** ∝ visit
  count; hue = continent. One annotation on the farthest destination.
- **Data:** `model.flown` → per destination: bearing + distance from `homeAt(date)`, visit count,
  `to.continent`. New helpers `bearingDeg(from,to)` (atop existing haversine) + `destinationsFromHome`.
- **Replaces (later):** **How Far From Home + Distance Bands.**
- **Notes:** rings LABELED so log/sqrt radius isn't misread. sqrt-area sizing (never radius=count).

### Task 6 — ④ Home & Away ribbon  (effort M) — **REDESIGN THE FORM**
- **id/title:** `homeAway` / "Home & Away". Icon 🏡, accent lime. `fullWidth`.
- **Problem with the mockup:** the day-mosaic hatches and the spiky rolling-share line fight each other;
  labels clip. **Redesign:** ONE clean encoding — a per-year horizontal ribbon, one row per year, one
  cell per day: HOME days = warm paper (bare); AWAY days = filled, colored by the trip's farthest
  continent (domestic=lime, transatlantic=indigo, transpacific=magenta). **Drop the spiky sparkline.**
  Optionally a thin right-margin "% nights away" number per year (text, not an overlaid line).
  Two bracket annotations: longest unbroken home stretch + longest away stint. Hatch = reconstructed
  boundary.
- **Data:** reconstructed TRIPS (`reconstructTrips` from `src/engine/stats.ts`) → daily home/away per
  year; `to.continent`/`to.region`; `homeAt`.
- **Replaces (later):** **Nights Away** (and complements Commuter Cadence).
- **Notes:** negative space (home) carries the emotion. Flag estimated boundaries. Keep it calm.

---

## Quick-wins (separate cleanup pass, NOT in this branch unless trivial)
- **Aircraft Class Bar** — delete (literal dup of Aircraft Class).
- **Day of Week** — retire or fold into a weekly-rhythm ring.
- **Travel Intensity** — upgrade fake 12-month grid → real 365-day GitHub-style day-mosaic (4-step legend).
- **Flight Personality** — demote horoscope; back it with data-ink or retire.

## Replacement ledger (apply only after Vijay signs off on each new card)
| New card | Retires / absorbs |
|---|---|
| ① Spiral Year-Clock | — (net-new hero) |
| ② Allegiance Streamgraph | Career Arc, Airline Eras |
| ③ Body-Clock | When You Fly, When-You-Fly overlay, Red-Eyes |
| ④ Home & Away | Nights Away |
| ⑤ Range Bloom | How Far From Home, Distance Bands |
| ⑥ Year Blooms | — (net-new; monthly-seasonality) |

Nothing is deleted until Vijay confirms the replacement looks right with his real data.
