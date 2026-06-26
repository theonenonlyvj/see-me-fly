# Flight Visualizer — Phase 2+3 Plan (Remaining Cards + Offline Map, display-only)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax. Implementer subagents MUST NOT spawn their own subagents — write all files directly.

**Goal:** Add the remaining stat cards + creative cards + the offline world Map to the Pop-themed app, all **display-only** (no click-through — deferred). Each card is a thin renderer over a pure, tested engine aggregator + the existing `CardFrame`/`BarList` (or a new chart) in the Pop style.

**Architecture:** New pure aggregators live in `src/engine/stats.ts` (tested, operate on `EnrichedFlight[]` + `Settings`, like the existing `aggregate.ts`). Cards call them on `model.scoped` via the `CardContext`. New chart primitives (`CalendarHeatmap`, `HourHistogram`, `WorldMap`) join `BarList`. The Map renders from a **bundled** world TopoJSON with D3 (no tiles, no runtime network). Cards register in the existing `CARDS` manifest with `{accent, icon}`.

**Tech Stack:** existing React+TS+Vitest+Pop theme. New deps: `d3-geo`, `topojson-client`, `world-atlas` (countries-110m), `@types/d3-geo`, `@types/topojson-client`.

## Global Constraints
- Display-only — NO click-through / Flight Detail / popups (deferred). Lists show top-N + "show more" (no row onClick).
- Offline: no runtime network/fetch; no web workers; reference + map geometry `import`ed (bundled). Single-file build stays < 8 MB (watch it after world-atlas; countries-110m is ~110 KB).
- Engine frozen except the NEW `src/engine/stats.ts` (+ tests). Do not modify existing engine files' behavior.
- `today` injected (already threaded via App→useModel; aggregators that need "today" receive it as a param).
- Cards consume engine aggregators — no re-aggregation in JSX.
- Pop style: each card has an accent (from `--accent-1..6`) + emoji icon via `CardFrame`; bars via `BarList` (accent-colored); Fraunces numbers; tabular-nums.
- Routes/airports identity respects `settings` (grouping/unique) via existing `airportKey`/`routeKey`/`classifyRoute`.

## Engine aggregator API to build (`src/engine/stats.ts`)

All pure, all take `(flights: EnrichedFlight[], settings: Settings, ...)`. Signatures (cards depend on these names/types):

- `byCountry(flights, settings): { code: string; name: string; count: number; flag: string }[]` — distinct flights per country (credit each resolved endpoint's country once per flight; dedupe a flight that touches the same country twice). For **US, IN, MX**, ALSO expose a `regions: {region:string; name:string; count:number}[]` sub-breakdown on those entries. Sorted desc. Uses `countryName`, `regionName`, `flagEmoji`.
- `superDomestic(flights, settings): { tier: 'intra-state'|'intra-country'|'intra-continent'; routes: {key:string; count:number}[] }[]` — routes grouped by `classifyRoute` tier (excluding intercontinental), each tier's routes ranked by count.
- `intercontinental(flights, settings): {key:string; count:number; miles:number}[]` — routes where `classifyRoute==='intercontinental'`, ranked.
- `extremeFlights(flights, by: 'distance'|'duration', dir: 'short'|'long', n=10): EnrichedFlight[]` — n flights sorted; excludes null metric; for distance excludes 0-mi local flights when `dir==='short'`.
- `byMonth(flights): { ym: string; count: number }[]` and `byYearMonthMatrix(flights): { year:number; months:number[] }[]` (12-slot arrays) for the calendar heatmap.
- `hourHistogram(flights, which: 'dep'|'arr'): number[]` — length-24 counts from `depHourLocal`/`arrHourLocal` (skip null).
- `byAircraft(flights): { byClass: {cls:string; count:number}[]; byType: {type:string; count:number}[] }` — class excludes blank; type excludes blank.
- `byTail(flights, minFlights=2): { tail:string; count:number; from:string; to:string }[]` — tails with ≥ minFlights, sorted desc; note coverage caveat in the card.
- `delayStats(flights): { onTimePct:number; counted:number; mostDelayed: EnrichedFlight[]; canceled:number; diverted:number }` — delay from `delayMin` (non-null), on-time = delayMin ≤ 15; mostDelayed top 10.
- `geoExtremes(flights): { north:Airport; south:Airport; east:Airport; west:Airport; farthest:{airport:Airport; miles:number} }` — over resolved airports visited; farthest from home (Dallas group / DFW coords — `HOME = {lat:32.8968, lon:-97.0380}`), using `haversineMi`.
- `records(flights, today): { mostInDay:{date:string; count:number}; busiestMonth:{ym:string; count:number}; busiestYear:{year:number; count:number}; longestGapDays:number; milestones:{ordinal:number; flight:EnrichedFlight}[] }` — reuse `milestones` from aggregate.ts; longestGap = max day-gap between consecutive flown flights.
- `odometer(flights): { miles:number; aroundEarth:number; toMoonPct:number }` — miles total; aroundEarth = miles/24901; toMoonPct = miles/238900*100.

Each gets unit tests in `src/test/engine/stats.test.ts` with small fixtures + hand-computed expecteds (e.g. byCountry US count, intercontinental HNL↔DFW present, geoExtremes farthest = a known far airport, odometer aroundEarth math, hourHistogram bucket).

---

## Tasks

### Task 1: Engine stats — geography (byCountry, superDomestic, intercontinental)
**Files:** Create `src/engine/stats.ts` (these 3 fns); Test `src/test/engine/stats.test.ts`.
**Interfaces:** Produces `byCountry`, `superDomestic`, `intercontinental` per the API above; consumes `classifyRoute`(classify.ts), `routeKey`/`airportKey`(normalize.ts), `countryName`/`regionName`/`lookupAirport`(reference.ts), `flagEmoji`(app/lib/format — MOVE `flagEmoji` to `src/engine/reference.ts` or duplicate as a tiny pure fn in stats.ts to keep engine self-contained; prefer a local `flagEmoji` in stats.ts).
- [ ] Step 1: Write failing tests: byCountry on a 3-flight fixture (DFW→AUS, DFW→LHR, HNL→DFW) → US present with count, GB present, regions includes US-TX; superDomestic groups DFW→AUS under intra-state; intercontinental includes the HNL↔DFW + DFW↔LHR routes. (Build flights via existing `enrichFlight`+`parseFlightyCsv`.)
- [ ] Step 2: Run → FAIL.
- [ ] Step 3: Implement the 3 fns in stats.ts (dedupe country-per-flight; tier via classifyRoute; route keys via routeKey with settings).
- [ ] Step 4: Run `npm --prefix /Users/vijayram/Cursor/flight_visualizer test -- stats` → PASS; full suite.
- [ ] Step 5: Commit `feat(engine): stats — byCountry/superDomestic/intercontinental`.

### Task 2: Engine stats — flights & records (extremeFlights, records, odometer, geoExtremes)
**Files:** extend `stats.ts` + `stats.test.ts`.
- [ ] Failing tests: extremeFlights(distance,short) excludes 0-mi locals & returns ascending; extremeFlights(duration,long) descending; odometer.aroundEarth = round(miles/24901,1); geoExtremes.farthest picks the airport farthest from DFW (use a fixture with LHR/HNL); records.mostInDay counts a 2-flights-same-date fixture. → FAIL.
- [ ] Implement (reuse `milestones`, `haversineMi`; HOME const). Run → PASS; full suite.
- [ ] Commit `feat(engine): stats — extremes/records/odometer/geoExtremes`.

### Task 3: Engine stats — time, aircraft, tail, delay (byMonth, byYearMonthMatrix, hourHistogram, byAircraft, byTail, delayStats)
**Files:** extend `stats.ts` + `stats.test.ts`.
- [ ] Failing tests: hourHistogram('dep') length 24, correct bucket for a 09:00 flight; byAircraft.byClass excludes blank; byTail returns only ≥2 tails; delayStats.onTimePct over a fixture (one 5-min, one 40-min late → 50% on-time, mostDelayed[0] the 40-min). → FAIL.
- [ ] Implement. Run → PASS; full suite.
- [ ] Commit `feat(engine): stats — time/aircraft/tail/delay`.

### Task 4: Chart primitives — CalendarHeatmap + HourHistogram
**Files:** Create `src/app/components/charts/CalendarHeatmap.tsx`, `HourHistogram.tsx`; tests in `src/test/app/charts.test.tsx`.
**Interfaces:** `CalendarHeatmap({ matrix, accent })` (matrix = byYearMonthMatrix output; renders a year×month grid, cell opacity ∝ count, accent color); `HourHistogram({ counts, accent })` (24 bars, hand-rolled SVG/CSS, accent gradient). Follow the Pop bar styling. Global RTL cleanup configured.
- [ ] Failing tests: CalendarHeatmap renders a cell for each year row; HourHistogram renders 24 bars + a peak label. → FAIL.
- [ ] Implement (CSS/SVG, accent-colored, tokens). Run → PASS; full suite.
- [ ] Commit `feat(charts): calendar heatmap + hour histogram`.

### Tasks 5–10: Stat + creative cards (display-only, Pop style)
For EACH card below: create `src/app/cards/<Name>Card.tsx` exporting `{ id, title, group, accent, icon, render }`, rendering via `CardFrame` (+ `BarList`/chart) over its aggregator called on `ctx.model.scoped` with `ctx.settings`; register in `CARDS`; write a focused jsdom test asserting a key value/label appears (build a model via `buildModel` on a small CSV); run the card test + full suite; **commit per card**. Use existing cards (AirportsCard, RoutesCard) as the pattern. Pick accents so adjacent masonry cards differ; show ~10 rows.

Cards (id · title · icon · accent · aggregator · chart · key test assertion):
- [ ] **Task 5 — countries** · "Countries & states" · 🌍 · accent-3 · `byCountry` · BarList (flag+name; expandable region sub-list for US/IN/MX) · test: "United States" row appears with a flag.
- [ ] **Task 6 — superDomestic** · "Super-domestic" · 🏠 · accent-5 · `superDomestic` · grouped BarList by tier · test: an intra-state route appears under its tier.
- [ ] **Task 7 — intercontinental** · "Intercontinental" · 🌐 · accent-4 · `intercontinental` · BarList · test: an intercontinental route (e.g. contains London or HNL) appears.
- [ ] **Task 8 — shortest/longest** · TWO cards: "Shortest flights" ✂️ accent-6 and "Longest flights" 🛬 accent-1 · `extremeFlights` with a time/distance toggle (useState) · list rows (date · route · value) · test: longest card shows a far route; toggle switches metric.
- [ ] **Task 9 — aircraft** · "Aircraft" · ✈️ · accent-2 · `byAircraft` · BarList (class) + top types · test: a class bucket (e.g. "narrow"/"wide") appears. Caveat note re: 47 blank-type rows.
- [ ] **Task 10 — sameMetal + delay** · TWO cards: "Same metal (tails)" 🔧 accent-3 (`byTail`, with "from ~2013" coverage caveat) and "Delays" 😤 accent-1 (`delayStats`: on-time %, most-delayed list, cancellations) · BarList/list · test: tail card shows a tail with ≥2; delay card shows an on-time %.

### Task 11: Creative cards — Odometer, Records, Geo-extremes, When-you-fly
**Files:** 4 card files + registry + tests.
- [ ] **odometer** · "Around the world" · 🌍 · accent-4 · `odometer` · big Fraunces hero ("12.4× around the Earth", "X% to the Moon", total miles) · test: "around the Earth" text appears.
- [ ] **records** · "Records & streaks" · 🏆 · accent-2 · `records` · stat list (most in a day, busiest month/year, longest gap, milestones 100th/500th/1000th) · test: a milestone or "busiest year" appears.
- [ ] **geoExtremes** · "Geographic extremes" · 🧭 · accent-5 · `geoExtremes` · N/S/E/W-most + farthest-from-home · test: the farthest airport name appears.
- [ ] **whenYouFly** · "When you fly" · ⏰ · accent-6 · `hourHistogram` (dep + arr) via `HourHistogram` · test: 24 bars render. Plus a calendar via `CalendarHeatmap` + `byYearMonthMatrix` as a "Travel intensity" card (id `intensity`, 📅, accent-3) — or fold into one. (Two cards: when-you-fly + intensity.)
- [ ] Register all; per-card commits; full suite green.

### Task 12: Offline World Map (hero)
**Files:** Create `src/app/components/charts/WorldMap.tsx`, `src/app/cards/MapCard.tsx`; deps; test `src/test/app/world-map.test.tsx`.
**Interfaces:** install `d3-geo topojson-client world-atlas @types/d3-geo @types/topojson-client`. `WorldMap({ routes, accent })` where routes = `model.byRoute` mapped to endpoint coords (resolve each route's two airports → lat/lon via `lookupAirport`; for grouped keys, use the group's primary airport coords). Import `world-atlas/countries-110m.json` (bundled). Render with `d3.geoNaturalEarth1()` + `geoPath` for countries (filled subtle) and great-circle arcs via `d3.geoInterpolate`/`geoPath({type:'LineString'})`, thickness/opacity ∝ route frequency. **Clip/split antimeridian-crossing arcs** (d3 handles via the projection when arcs are LineStrings sampled along the great circle — sample ~50 points with geoInterpolate so geoPath clips correctly). Output inline SVG (no tiles). `MapCard` (id `map`, "Your map", 🗺️, full-width — span all masonry columns).
- [ ] Step 1: Failing test: WorldMap renders an `<svg>` with country paths + at least one arc path for a 2-route fixture. → FAIL.
- [ ] Step 2: Implement WorldMap (sample arcs via geoInterpolate(50 pts) → LineString → geoPath; projection fit to a fixed viewBox; countries from topojson `feature()`); MapCard spans full width (CSS `column-span: all`).
- [ ] Step 3: Run map test + full suite → PASS.
- [ ] Step 4: `npm run build` → confirm single-file < 8 MB (world-atlas ~110 KB). Report size.
- [ ] Step 5: Commit `feat(card): offline world map (D3 + bundled TopoJSON)`.

### Task 13: Integration pass + ordering + final build
**Files:** `src/app/cards/registry.ts` (final CARDS order — Map first/hero, then Overview, then the rest), maybe minor CardGrid (full-width map handling).
- [ ] Order CARDS sensibly (Map hero spanning full width; Overview + Odometer prominent; then geography, routes, time, aircraft, delay, records, extremes).
- [ ] Full suite green; `npm run build` single-file < 8 MB; `npm run dev` manual sanity (human check — drop real CSV, all cards render, map shows arcs).
- [ ] Commit `feat(app): final card ordering + full-width map`.

## Acceptance
- `npm test` green (engine stats + all card/chart tests); `npm run build` one self-contained `dist/index.html` < 8 MB, no network refs.
- All remaining cards render on the real export in the Pop style; the Map draws great-circle arcs offline; everything recomputes on scope/settings changes.
- No click-through (deferred); no card reorder (deferred).

## Self-review notes
- Watch bundle size after world-atlas (countries-110m, not 50m — 110m is ~110 KB).
- `flagEmoji` currently lives in `src/app/lib/format.ts` (from the Pop refresh) — for engine `byCountry`, add a local pure `flagEmoji` in `stats.ts` (don't make the engine import from the app layer).
- Reuse `milestones` from `aggregate.ts` for records (don't reimplement); note the day-granularity limitation already tracked.
