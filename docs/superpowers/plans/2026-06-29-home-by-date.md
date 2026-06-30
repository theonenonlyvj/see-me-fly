# Home-by-Date Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. Spec: `docs/superpowers/specs/2026-06-29-home-by-date-design.md` — read it; this plan assumes it.

**Goal:** Make every home-relative statistic reflect where the user lived **on each flight's date**, via a user-owned home timeline + ground segments, without changing any flight totals.

**Architecture:** A total `homeAt(date)`/`hasHome`/`homeKeys` resolver in `engine/home.ts`; trip reconstruction over all-time flights using a unified flight+link movement stream; era-correct migration of each home-relative consumer; two branded localStorage CSVs with an editor. Ships generic/empty.

**Tech Stack:** Vite + React 19 + TS + Vitest; PapaParse (already a dep — confirm in Task 3) for RFC-4180 CSV; D3 map already present.

## Global Constraints (every task inherits these)

- **Flight COUNTS and DISTANCE TOTALS never change** — only home-relative outputs move.
- **Nothing personal in the repo.** App ships with `homeHistory: []`, `groundLinks: []`.
- **Branded files:** `see-me-fly_homes.csv`, `see-me-fly_links.csv`, each with a `schema_version` column; export "Download my see-me-fly data" (date-stamped).
- **Date-resolved, not year.** A year can hold several homes.
- **Trips reconstruct ONCE over `model.flown` (all-time), then slice `Trip[]` by `Trip.year`.** Never reconstruct over `model.scoped`.
- **`homeAt` is total** — pre-first-era flights clamp to the first era; null only when `!hasHome`.
- **Backward compatible** — empty `homeHistory` behaves exactly like today's single `Settings.home`.
- Offline / single-file build conventions unchanged; bundle budget suspended until "final."
- TDD: write the failing test first, watch it fail, implement minimally, watch it pass, commit. One logical change per commit.

## File Structure

- Create: `src/engine/home.ts` (resolver: `homeAt`, `hasHome`, `homeKeys`, `ResolvedHome`).
- Create: `src/engine/ground-links.ts` (Movement union + merge helper for flights+links).
- Create: `src/app/lib/see-me-fly-csv.ts` (parse/serialize the two branded CSVs, RFC-4180).
- Modify: `src/engine/types.ts` (Settings: `homeHistory`, `groundLinks`; `Trip.estimated`), `src/engine/index.ts` (`DEFAULT_SETTINGS`), `src/engine/stats.ts` (`reconstructTrips`, `geoExtremes`, `domesticTierOf`, `byCountry`, `homeDistanceTiers`), `src/engine/aggregate.ts` (`byAirport`), `src/app/lib/places.ts` (`homeKeys`), the consumer cards, `src/app/components/SettingsPanel.tsx`.
- Modify tests: `src/test/**` Settings factories (4), `stats.test.ts`, `geoExtremes-card.test.tsx`, and new tests per task.

---

## Task 1: Settings model + DEFAULT_SETTINGS + test factories

**Files:** Modify `src/engine/types.ts`, `src/engine/index.ts`; the 4 test `Settings` factories (grep `home: 'DFW'` / `home:'DFW'` to find them); Test: `src/test/engine/settings-defaults.test.ts` (create).

**Interfaces — Produces:**
```ts
interface HomeEra { start: string; airports: string[]; label?: string }
interface GroundLink {
  date: string; fromAirport: string; toAirport: string; mode: string
  arriveDate?: string; fromPlace?: string; toPlace?: string; departTime?: string; arriveTime?: string
  operator?: string; price?: number; currency?: string; bookingRef?: string; seat?: string; klass?: string; note?: string
}
// Settings gains: homeHistory: HomeEra[]; groundLinks: GroundLink[]
// Trip gains: estimated?: { boundary: 'start' | 'end' }
```

- [ ] **Step 1 — failing test:** in `settings-defaults.test.ts`, assert `DEFAULT_SETTINGS.homeHistory` deep-equals `[]` and `DEFAULT_SETTINGS.groundLinks` deep-equals `[]`; and that a `loadSettings`-style merge `{...DEFAULT_SETTINGS, ...{home:'DFW'}}` yields `homeHistory: []` (not undefined).
- [ ] **Step 2 — run, see it fail** (`npx vitest run src/test/engine/settings-defaults.test.ts`).
- [ ] **Step 3 — implement:** add `homeHistory: HomeEra[]` and `groundLinks: GroundLink[]` to the `Settings` interface (`types.ts`); add `homeHistory: []`, `groundLinks: []` to `DEFAULT_SETTINGS` (`index.ts:8`); add the `HomeEra`/`GroundLink` interfaces and `Trip.estimated` to `types.ts`. In the settings loader, coerce both to arrays (`Array.isArray(x) ? x : []`).
- [ ] **Step 4 — fix the 4 test factories:** add `homeHistory: [], groundLinks: []` to each enumerated `Settings` factory so `tsc` passes.
- [ ] **Step 5 — `npx tsc --noEmit` + run the test; green.**
- [ ] **Step 6 — commit:** `feat(home): add homeHistory/groundLinks to Settings + defaults`.

---

## Task 2: `engine/home.ts` — homeAt / hasHome / homeKeys

**Files:** Create `src/engine/home.ts`; Test: `src/test/engine/home.test.ts`.

**Interfaces — Consumes:** `HomeEra`, `Settings` (Task 1), `airportKey` (`places.ts`/engine). **Produces:**
```ts
interface ResolvedHome { airports: string[]; primary: string }            // airports[0] === primary
function hasHome(s: Settings): boolean                                     // homeHistory.length>0 || s.home != null
function homeAt(date: string, s: Settings): ResolvedHome | null            // total when hasHome
function homeKeys(s: Settings): { keys: Set<string>; primaryKey: string | null } // date-less union for aggregated consumers
function isHomeOn(code: string, date: string, s: Settings): boolean        // boundary-aware membership (see spec)
```

- [ ] **Step 1 — failing tests** (`home.test.ts`), each asserting one spec rule:
  - empty `homeHistory` + `home:'DFW'` → `homeAt('2020-01-01')` = `{airports:['DFW'],primary:'DFW'}`; `hasHome` true.
  - no home at all (`home:null`, `homeHistory:[]`) → `homeAt` null, `hasHome` false.
  - eras `[{start:'2008-08-18',airports:['CMH']},{start:'2019-06-01',airports:['DEN','SEA','PAE']},{start:'2021-02-04',airports:['DFW','DAL']}]`: `homeAt('2010-06-01').primary==='CMH'`; `homeAt('2019-06-01').primary==='DEN'` (move-day → new era); `homeAt('2025-01-01').primary==='DFW'`.
  - **pre-first-era clamp:** `homeAt('2006-01-01').primary==='CMH'` (earliest era), not null.
  - **boundary membership:** `isHomeOn('CMH','2019-06-01',s)` true AND `isHomeOn('DEN','2019-06-01',s)` true (either side of a move counts on the boundary date).
  - **grouping:** with `groupAirports:true`, `isHomeOn('PAE','2019-08-01',s)` true (SEA/PAE co-home) and uses `airportKey`.
  - **homeKeys union:** `homeKeys(s).keys` contains the `airportKey` of CMH, Seattle-group, DFW-group; `primaryKey` = most-recent era primary's key (DFW group).
- [ ] **Step 2 — run, see them fail.**
- [ ] **Step 3 — implement** per spec "Home Resolution": binary search half-open intervals on a sorted/deduped copy; clamp pre-first-era to `homeHistory[0]`; fallback to `home`; `isHomeOn` compares `airportKey(code,grouping)` against the union of the era containing `date` PLUS, when `date` equals an era `start`, the prior era too; `homeKeys` unions all eras' `airportKey`-normalized airports (+`home`) with `primaryKey` = last era's primary key.
- [ ] **Step 4 — run; green. `tsc`.**
- [ ] **Step 5 — commit:** `feat(home): homeAt/hasHome/homeKeys resolver`.

---

## Task 3: Branded CSV parse/serialize + loader hardening

**Files:** Create `src/app/lib/see-me-fly-csv.ts`; Test: `src/test/app/see-me-fly-csv.test.ts`. Confirm PapaParse is a dependency (`grep papaparse package.json`); if absent, add it (it is already used by the flight CSV parser — verify in `parse.ts`).

**Interfaces — Produces:**
```ts
const SMF_SCHEMA_VERSION = 1
function parseHomesCsv(text: string): { eras: HomeEra[]; errors: string[] }
function serializeHomesCsv(eras: HomeEra[]): string
function parseLinksCsv(text: string): { links: GroundLink[]; errors: string[] }
function serializeLinksCsv(links: GroundLink[]): string
function sanitizeHomeHistory(eras: HomeEra[]): HomeEra[]  // sort asc by start, drop zero-length/dupe starts (last wins), drop empty-airport
```

- [ ] **Step 1 — failing tests:**
  - **RFC-4180 round-trip:** a link with `fromPlace:'Cambridge, MA'`, `operator:'Coach Lines, Inc.'`, `bookingRef:'000123456789'` (leading-zero-safe) serializes then parses back identical (no comma corruption, ref stays a string).
  - `serializeHomesCsv` emits header `schema_version,start_date,home_airports,label` and slash-joins airports; `parseHomesCsv` reads them back; primary = first airport.
  - **malformed:** out-of-order / duplicate-start / zero-length eras → `sanitizeHomeHistory` returns sorted, de-duped (last-wins), zero-length-dropped; `parseHomesCsv` surfaces an `errors[]` entry but never throws.
  - `parseLinksCsv` with a blank `currency` but a `price` keeps `price` set and leaves currency undefined; `price:'1,200'` parses to `1200` after unquoting.
- [ ] **Step 2 — run, see fail.**
- [ ] **Step 3 — implement** with `Papa.unparse`/`Papa.parse(text,{header:true})`; `schema_version` column; `sanitizeHomeHistory`; numeric `price` via `Number(String(p).replace(/[, ]/g,''))` guarded.
- [ ] **Step 4 — green; `tsc`. Commit:** `feat(home): see-me-fly CSV parse/serialize + sanitize`.

---

## Task 4: Trip reconstruction — all-time + movement stream + bridge/close + estimated

**Files:** Create `src/engine/ground-links.ts`; Modify `src/engine/stats.ts` (`reconstructTrips`), and the trip-card slicing path; Test: `src/test/engine/reconstruct-trips-home.test.ts`.

**Interfaces — Consumes:** `homeAt`/`isHomeOn`/`hasHome` (Task 2), `GroundLink` (Task 1). **Produces:**
```ts
type Movement =
  | { kind:'flight'; sortMs:number; date:string; fromCode:string; toCode:string; flight:EnrichedFlight }
  | { kind:'link';   sortMs:number; date:string; fromCode:string; toCode:string; link:GroundLink }
function buildMovements(flights: EnrichedFlight[], links: GroundLink[]): Movement[]   // sorted; flights<links tiebreak then rawIndex
// reconstructTrips(flights, settings) now: runs over ALL flights passed (callers pass model.flown); returns Trip[] with estimated where guessed
```

- [ ] **Step 1 — failing tests** (build `EnrichedFlight`-lite fixtures with `fromCode/toCode/date/rawIndex`):
  - **relocation:** CMH-home until move; flights `CMH→ORD→…→PDX` (no home endpoint) + a link `PDX→SEA` dated after, home becomes SEA → exactly ONE trip spanning first leg → link arrival; `estimated` undefined; ORD same-day connection does NOT split it.
  - **connection-not-close:** during the SEA era, `…→PDX→SEA-area` same-day (≤`layoverMaxHours`) does not close at the co-home hub.
  - **link-to-non-home bridges:** a link whose `toAirport` isn't home extends the open trip, doesn't close.
  - **inferred end:** leave home, no return, no link, then next trip departs home → prior trip closes at its last leg's date with `estimated:{boundary:'end'}`.
  - **inferred start:** lone `SFO→DFW` (DFW home) with no prior departure → 0-night trip, `estimated:{boundary:'start'}`.
  - **year slice:** a Dec→Jan trip reconstructs as ONE trip; helper `tripsForYear(trips, y)` returns it under its departure year only.
- [ ] **Step 2 — run, fail.**
- [ ] **Step 3 — implement** `buildMovements` + rewrite `reconstructTrips`'s loop to iterate movements; close on arrive-home unless next movement redeparts same airport within `layoverMaxHours`; link-to-home closes, link-to-non-home bridges; fresh depart-from-home closes prior; inferred-boundary fallback sets `estimated`; deterministic `rawIndex` tiebreak.
- [ ] **Step 4 — update callers:** the four trip cards reconstruct over `model.flown` and slice with `tripsForYear` by the scope year (all-time scope = no slice); replace `!settings.home` gates with `hasHome`.
- [ ] **Step 5 — green; `tsc`; run existing trip tests (adjust fixtures that assumed scoped). Commit:** `feat(home): all-time trip reconstruction with ground-link movements`.

---

## Task 5: geoExtremes — global N/S/E/W + per-base farthest ranking

**Files:** Modify `src/engine/stats.ts` (`geoExtremes`), `src/app/cards/GeoExtremesCard.tsx`; Tests: update `src/test/engine/stats.test.ts:518-549`, `src/test/app/geoExtremes-card.test.tsx`.

**Interfaces — Produces:**
```ts
interface GeoExtremes {
  global: { north: ExtremePoint; south: ExtremePoint; east: ExtremePoint; west: ExtremePoint } | null
  byBase: Array<{ baseLabel: string; primaryCode: string; farthest: ExtremePoint; flightCount: number }> // ranked desc, [] when !hasHome
}
```

- [ ] **Step 1 — failing tests:** per-base farthest excludes the base's own home airports; bases merged by **primary** `airportKey`; ranked by miles desc with `rawIndex` tiebreak; `!hasHome` → `byBase:[]` but `global` still populated; empty `homeHistory` + single `home` → exactly one base equal to today's single-home farthest (backward-compat); a base whose `primaryCode` fails `lookupAirport` is skipped.
- [ ] **Step 2 — fail.**
- [ ] **Step 3 — implement** over the passed all-time flights: compute `global` N/S/E/W on the deduped airport set (home-independent, unchanged math); partition flights by `homeAt(f.date)` merged-by-primary base, exclude each base's home airports, compute farthest from the base primary's coords (resolve via `lookupAirport`; skip on null); rank.
- [ ] **Step 4 — card:** render the global N/S/E/W block (unchanged) + a "Farthest from each home" list (label `Dallas (DFW/DAL)` via existing metro member-code helper, farthest IATA/name + miles + flight-count chip), `ExtremeRow` click-through reading `model.flown`.
- [ ] **Step 5 — update the two tests to the new shape + a backward-compat case; green; `tsc`. Commit:** `feat(home): per-base farthest-from-home, global N/S/E/W`.

---

## Task 6: Date-aware home exclusion — byCountry, domesticTierOf, byAirport

**Files:** Modify `src/engine/stats.ts` (`byCountry`, `domesticTierOf`, `homeDistanceTiers`), `src/engine/aggregate.ts` (`byAirport`), `src/app/cards/AirportsCard.tsx`; Tests: `src/test/engine/home-exclusion.test.ts` (create) + adjust existing.

- [ ] **Step 1 — failing tests:**
  - `byCountry`: `DFW→ORD` on a 2019 (DEN-home) flight credits **Texas** (ORD home → skipped); the same route in 2022 (DFW home) credits **Illinois**. A same-day connection through a co-home hub is **not** excluded.
  - `domesticTierOf`: `DFW→AUS` in 2019 with home=DEN → **intra-country**, not intra-state (region compared to `homeAt(f.date).primary` region).
  - `byAirport`: with `excludeHomeFromRankings`, CMH is excluded from the airport ranking only for college-era flights; counts otherwise. (Exclusion now lives in `byAirport` per-flight; `AirportsCard` no longer post-filters.)
- [ ] **Step 2 — fail.**
- [ ] **Step 3 — implement:** thread `isHomeOn(code, f.date, settings)` into each; move `byAirport` exclusion into the engine as a per-flight drop; strip the `AirportsCard.tsx:31-34` post-filter and consume the engine result; `domesticTierOf` uses `homeAt(f.date).primary` region.
- [ ] **Step 4 — green; `tsc`. Commit:** `feat(home): date-aware home exclusion across rankings`.

---

## Task 7: Remaining consumers — places.ts, map anchor, distance/nights cards, titles, pills

**Files:** Modify `src/app/lib/places.ts` (`homeKeys` for route ordering), `src/app/components/charts/RouteMapV2.tsx` (anchor), `src/app/cards/HowFarFromHomeCard.tsx`, `NightsAwayCard.tsx`, `CommuterCadenceCard.tsx`, `Airports*` (home-pill copy), `SuperDomesticCard.tsx:15` (title), `Countries*`; Tests: per consumer in `src/test/app/`.

- [ ] **Step 1 — failing tests:** route ordering puts a `homeKeys`-union endpoint first; `RouteMapV2` rings every `homeKeys` member, current/scoped emphasized; `HowFarFromHome`/`NightsAway`/`CommuterCadence` use date-aware home (counts unchanged); SuperDomestic title reads "Within your home state(s)" with multiple distinct home regions; Airports home-pill copy = "Home airports excluded for the years each was home".
- [ ] **Step 2 — fail.**
- [ ] **Step 3 — implement** each, using `homeKeys`/`homeAt`/`hasHome`; gate all on `hasHome`.
- [ ] **Step 4 — green; `tsc`. Commit:** `feat(home): migrate remaining home-relative consumers`.

---

## Task 8: Editor UI + import/export in SettingsPanel

**Files:** Modify `src/app/components/SettingsPanel.tsx`; maybe `src/app/components/home/HomeHistoryEditor.tsx` + `GroundLinksEditor.tsx` (create, keep files focused); Test: `src/test/app/home-editor.test.tsx`.

- [ ] **Step 1 — failing tests:** add/remove/reorder eras (validates ascending dates, ≥1 airport, warns on multi-group era); add a ground link (place→nearest-airport autocomplete, requires currency-if-price); "Download my see-me-fly data" produces the two date-stamped CSVs; import restores via `parse*Csv` + `sanitizeHomeHistory` with a post-import summary (rows + errors); ships empty by default.
- [ ] **Step 2 — fail.**
- [ ] **Step 3 — implement** the editor + import/export wired to `see-me-fly-csv.ts` and localStorage; per-file idempotent import; surfaced errors.
- [ ] **Step 4 — green; `tsc`. Commit:** `feat(home): home-history + ground-links editor with import/export`.

---

## Task 9: Integration — full suite, build, visual pass

**Files:** none new.

- [ ] **Step 1:** `npx tsc --noEmit && npx vitest run && npm run build` — all green; bundle builds (budget suspended).
- [ ] **Step 2:** `npm run dev` visual check: empty state = today's behavior; load a sample `homeHistory`+`groundLinks`; verify trips (relocation as one trip), per-base geoExtremes, date-aware exclusion, map rings, editor import/export.
- [ ] **Step 3 — commit** any test/fixups: `test(home): integration green`.

---

## Task 10: Draft the user's real data (separate from the build)

**Not repo code.** After the feature works, a user's `see-me-fly_homes.csv` + `see-me-fly_links.csv` are drafted from their own history (any existing ground-links record + an anchor-pass over their flight CSV) for them to import and correct. These files are user data — delivered to the user, never committed to the app repo.

---

## Execution

Subagent-driven: one implementer subagent per task, a task review (spec + quality) after each, a broad whole-branch review at the end, then `finishing-a-development-branch` to merge into main (which auto-deploys). Main stays at v1.0.0 until that merge.
