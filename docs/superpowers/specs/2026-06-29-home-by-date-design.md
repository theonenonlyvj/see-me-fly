# Home-by-Date — Design Spec

**Status:** design approved in collaborative brainstorming (2026-06-29); revised after an adversarial multi-lens review (verdict: important-revisions, now folded in). Pre-implementation. Built on the `home-by-date` branch; main is frozen at tag `v1.0.0`.

**Goal:** Replace the single `Settings.home` with a *time-aware* home so every home-relative statistic reflects where you actually lived **on each flight's date** — without changing any flight totals.

**Architecture:** A user-owned home timeline + a user-owned set of significant ground segments, both stored as branded CSVs in localStorage (downloadable; account-syncable later). A single, **total** `homeAt(date)` resolver threads date-aware home through the consumers listed below. Trip reconstruction runs **once over all-time flights** (sliced by year afterward) and gains ground-segment gap-closing. Nothing about any individual's life is hard-coded in the app.

---

## Global Constraints (bind every task)

1. **Flight COUNTS and DISTANCE TOTALS never change.** Home-by-date only affects *home-relative* outputs (farthest-from-home, nights-away, the close-to-home splits, trip reconstruction, map home-anchor, and home exclusion from rankings).
2. **No personal data in the app.** The app ships generic and empty. The home timeline and ground segments are USER DATA in localStorage, never in the repo or source.
3. **Branded filenames:** `see-me-fly_homes.csv`, `see-me-fly_links.csv`, each carrying a `schema_version`. Export button label: "Download my see-me-fly data" (date-stamped).
4. **Date-resolved, not year-resolved.** A single calendar year may contain multiple homes (2012 = RDU → Europe → Milwaukee). Home is keyed to the exact flight date. The year-scope dropdown stays independent of home.
5. **Backward compatible.** An empty home timeline behaves exactly like today's single `Settings.home`. `homeAt` is **total** (never silently null while any home info exists — see Home Resolution).
6. **Trips reconstruct once over the all-time list, then slice by year.** `reconstructTrips` runs over `model.flown` (all-time, global filters only — NOT the year-scoped list), and the year dropdown slices the resulting `Trip[]` by `Trip.year`. Reconstructing over year-scoped flights would fragment every cross-year relocation trip and drop ground links that bridge into another year.
7. Stays offline / single-file / under the existing build conventions. Bundle-size budget is suspended by user direction until the app is "final."

---

## Data Model

### Home timeline — `Settings.homeHistory: HomeEra[]`
```ts
interface HomeEra {
  start: string          // 'YYYY-MM-DD', inclusive
  airports: string[]     // one or more codes; airports[0] = PRIMARY
  label?: string         // freeform, e.g. "College — Durham"
}
```
- Ordered ascending by `start`. Each era runs `[start, nextEra.start)` (half-open); the last era runs to the present.
- `airports` may hold several co-home codes (e.g. `['MKE','ORD','MDW']` — drove to Chicago for fares). `airports[0]` is the **primary**.
- **One base per era** (confirmed): an era lists co-located airports for one base; two *separate* simultaneous home regions are out of scope. Validation should **warn** if one era's airports span more than one distinct `airportKey` group when grouping is ON (e.g. an era mixing Chicago and Milwaukee group keys is suspicious).
- **Normalization:** all membership/dedup comparisons run on `airportKey(code, settings.groupAirports)`, never raw codes — with grouping ON, `ORD`+`MDW` collapse to one Chicago key while `MKE` stays separate.
- Empty `homeHistory` ⇒ fall back to the single `Settings.home` (backward compat).

`DEFAULT_SETTINGS` (`engine/index.ts:8`) **must gain** `homeHistory: []` and `groundLinks: []` so the `{...DEFAULT_SETTINGS, ...stored}` merge-on-load gives old localStorage blobs defined arrays. Loader coerces both to arrays defensively.

**Serialized as `see-me-fly_homes.csv`** (RFC-4180, header row, `schema_version`):
```
schema_version,start_date,home_airports,label
1,2008-08-18,RDU,College — Durham
1,2009-05-15,DFW/DAL,Summer — Dallas
1,2012-07-03,MKE/ORD/MDW,Moved to Milwaukee
1,2013-01-15,DFW/DAL,Back to Dallas (present)
```
`home_airports` is slash-joined; first = primary. Each row starts an era; the last runs to present.

### Ground segments — `Settings.groundLinks: GroundLink[]`
```ts
interface GroundLink {
  date: string             // 'YYYY-MM-DD' departure date  (CORE)
  fromAirport: string      // nearest airport code at origin (CORE)
  toAirport: string        // nearest airport code at destination (CORE)
  mode: string             // 'drive' | 'bus' | 'train' | 'ferry' | 'other' (CORE)
  // optional record fields — captured if known, "useful later", never required:
  arriveDate?: string      // for multi-day drives / overnight buses; used for the home check
  fromPlace?: string       // the real, possibly non-airport origin (stop / hotel / city)
  toPlace?: string
  departTime?: string
  arriveTime?: string
  operator?: string        // RedCoach, Megabus, Vonlane, ADO, Amtrak, self…
  price?: number
  currency?: string        // foreign OK (e.g. 'MXN')
  bookingRef?: string
  seat?: string
  klass?: string           // "class" — fare/coach class
  note?: string
}
```
**Place↔airport model:** `fromPlace`/`toPlace` are the *truth* (a downtown bus stop, a hotel, a foreign city). `fromAirport`/`toAirport` are the **nearest airport the user tags** so the segment plugs into the airport-based flight graph. The editor autocompletes a nearby airport from a typed place.

**Serialized as `see-me-fly_links.csv`** (RFC-4180 quoting via Papa.unparse/parse `header:true`, `schema_version` column, blanks allowed). Free-text fields (`fromPlace`, `toPlace`, `operator`, `label`) WILL contain commas/quotes ("Cambridge, MA"; "RedCoach, Inc.") — naive comma-split is forbidden; a round-trip test must cover embedded commas/quotes and leading-zero refs.

**`price`/`currency` rule:** `price` parses as `Number` only after RFC-4180 unquoting (strip thousands separators); a `price` with blank `currency` is left **uninterpreted and never summed**; editor validation requires `currency` when `price` is set.

**Role of ground links (Phase A):** they ONLY help **close trip gaps** in reconstruction (see the unified movement type below). They do **not** add to any flight stat (counts, miles, airlines, etc.). "Can filter into stats later" is an explicit future phase.

---

## Home Resolution

A small `src/engine/home.ts`:
```ts
interface ResolvedHome { airports: string[]; primary: string }   // airports[0] === primary
function homeAt(date: string, settings: Settings): ResolvedHome | null
function hasHome(settings: Settings): boolean                     // homeHistory non-empty || settings.home != null
```
- Binary-search `homeHistory` (assumed strictly ascending, de-duped — guaranteed by the loader, below) for the era containing `date` via half-open `[start, nextStart)`.
- **Totality (must-fix):** a flight dated **before** `homeHistory[0].start` clamps to the **first** era (your earliest known home), NOT null. `homeAt` returns null **only** when there is no home info at all (`!hasHome`). Empty `homeHistory` ⇒ resolve from `Settings.home`. There is a unit test for the pre-first-era case.
- **Boundary date (move day):** half-open intervals put a flight ON a move date under the NEW home. To keep a same-day relocation *departure* from the old home able to close the prior trip, the **from-endpoint / ground-link arrival** check treats an endpoint as "home" if it matches EITHER the closing prior era OR the opening new era on that boundary date. Ground-link home checks use `arriveDate ?? date`.

**`hasHome(settings)` replaces every `!settings.home` gate.** Five sites gate on the scalar today (the four trip cards + `reconstructTrips`); with a populated `homeHistory` but the legacy `Settings.home` cleared they would wrongly show "set a home" / zero trips. All five must use `hasHome`.

**"At home" semantics:**
- **Set membership** — an endpoint is "home" if `airportKey(code, groupAirports)` matches ANY airport (also key-normalized) in that date's `ResolvedHome.airports`. Used for: trip boundaries, home-exclusion from rankings, the map home-anchor, home-first route ordering, the Airports home-pill.
- **Single reference = `primary`** — for the stats that need one point: `domesticTierOf` intra-state region (the flight's era-home primary) and `geoExtremes` farthest-from-home (each **base's** primary — geoExtremes is computed per base; see Consumers).

**Date-less consumers (structural):** route ordering (`places.ts`), the map anchor, and the SuperDomestic title operate on **aggregated, date-less keys** — there is no single flight date to resolve. For these, define **`homeKeys(settings)`** = the **set-union** of every era's `airportKey`-normalized home airports (plus `Settings.home`), with a deterministic tiebreak = the **most-recent era's primary**. A route flown in two eras whose far end was home in one of them orders as home via the union.

---

## Trip Reconstruction (all-time, with ground links)

`reconstructTrips` runs over **`model.flown`** (Constraint 6) and today closes a trip when a leg ARRIVES home and when a fresh leg DEPARTS home. Changes:

### Unified movement stream
Ground links lack the fields `reconstructTrips` iterates (`depUtcMs`, `resolved`, `fromCode`, …), so reconstruction iterates a **`Movement`** union, not raw flights:
```ts
type Movement =
  | { kind: 'flight'; sortMs: number; date: string; fromCode: string; toCode: string; flight: EnrichedFlight }
  | { kind: 'link';   sortMs: number; date: string; fromCode: string; toCode: string; link: GroundLink }
```
- Flights and links merge into one chronologically-sorted stream; `sortMs` for a link derives from `date` (+`departTime` if present). **Deterministic tiebreak** for same-instant items (define: flights before links, then original index).
- Only `kind: 'flight'` movements contribute to trip *flight* lists / stats; links are bridges only.

### Close / bridge rules
1. **Home** is evaluated per movement via `homeAt(mvmt.date)` set-membership (with the boundary-date rule for the from-endpoint).
2. **Arrive-home closes — unless it's a connection.** A movement arriving at a home airport closes the trip, **except** when the next movement redeparts the *same* airport within `layoverMaxHours` (a connection, not an arrival). This precondition must gate the existing unconditional close-on-arrive-home trigger (`stats.ts:744-750`), or a same-day co-home-hub connection (ORD during the Milwaukee era) would wrongly split the relocation trip.
3. **Ground link to home closes; link to non-home bridges.** Selection: the **earliest** link with `fromAirport == lastArrival` and `(arriveDate ?? date) >= arrivalDate`. If its `toAirport` is home on the link date → close at the link's arrival. If not home → the link **bridges** (extends the open trip to a new away-location) but never closes.
4. **Fresh depart-from-home** still closes any still-open prior trip.

### Worked example — the 2012 post-college relocation (RDU → Milwaukee)
Home is **RDU through the move**. Journey: `MCO→IAD→FRA→ISL→…→MUC→IAD→ORD→IAH` (May 26 – Jun 22), an ~11-day Houston wedding gap, then a `drive IAH→MKE` link departing **2012-07-03**, arriving ~Jul 5.
- You left RDU and never returned, so the trip stays **OPEN the entire time** — Europe *and* the Houston gap — because you don't touch a home airport again until Milwaukee. (ORD on Jun 22 is a same-day connection to IAH per rule 2, not a home arrival.)
- The **drive IAH→MKE closes the trip** (rule 3: a ground link lands you at a home airport — MKE is home from the move), at the ~Jul 5 arrival. The Jun 22 IAH flight is just the last flight leg.
- **Result: one ~40-night relocation trip.** Reconstruction over all-time flights (Constraint 6) is what lets it span late-May → July as one trip; year-scoped reconstruction would have split it at the year boundary (it doesn't here, but a Dec→Jan move would). Relocation trips open at the old home and close at the **new** home; the in-between wedding is part of the single trip by design.

### Inferred boundaries (no link)
When a trip can't be cleanly bracketed and no link resolves it, collapse the **unknown** boundary to the nearest **known** leg and **flag** it:
- **Left home, no recorded return and no link** → assume you returned home on the date of the trip's **last recorded leg** (keep real away-nights up to that leg; add none beyond). Prevents an open trip absorbing the next one.
- **Only a homeward leg** (`SFO→DFW`, no preceding departure) → the trip **started that same day** (a 0-night blip).
- Such trips carry `estimated: true` (with which boundary was guessed). Their **conservative** nights/counts **still feed aggregate totals**, but the trip shows an **"estimated" badge** and is **filterable as "needs a link."**
- **Year attribution:** nights credit to `Trip.year` (departure year) as today; because reconstruction is all-time (Constraint 6), a year-spanning trip no longer vanishes under a later-year scope — it slices to its departure year. (`estimated` is a derived field on `Trip`, not persisted.)

---

## Consumers to Migrate (corrected locations + structural fixes)

Thread `homeAt(flight.date, settings)` / `homeKeys(settings)` / `hasHome(settings)` where the single home is read today:

- **`geoExtremes` (`stats.ts:437-466`) — split: GLOBAL N/S/E/W + PER-BASE farthest-from-home.** Key correction from review: **N/S/E/W are home-INDEPENDENT** (pure global max/min lat/lon, `stats.ts:460-463`); only *farthest* uses a home reference. So:
  - **N/S/E/W stay ONE global block** over all touched airports (today's fixed 5-row layout, eyebrow "The edges of your map"), computed on `model.flown`. No per-base split.
  - **Only "farthest from home" becomes per-base.** Partition flights by era-home via `homeAt(flight.date)`, comparing endpoints with `airportKey(f.fromCode/f.toCode, groupAirports)` on **RAW codes** (NOT `f.from.ident` `'KDFW'` — the ident-keyed map stays only for distinct-airport dedup). **Merge eras by PRIMARY `airportKey`** (a `DFW` era and a later `DFW/DAL` era both = "Dallas"; merged base's home-exclusion set = union of merged eras' airports; most-recent era's label/primary wins). For each base, farthest = great-circle from that base's **primary** over that base's flights, **excluding the base's own home airports** from candidates (else a 1-flight `DFW→AUS` base or a local-only RPJ era returns home itself). **Rank bases by farthest miles, descending** (no count weighting); deterministic tiebreaks via `rawIndex` within a base (as `reconstructTrips`, `stats.ts:727`) and a defined base-order tiebreak. The top row = "the farthest you ever got from whatever home you had then" — an honest era-correct number, **not equal** to today's DFW-referenced figure (don't claim equivalence).
  - **Always over `model.flown`** (all-time); the year dropdown is inert for this ranking, and the click-through overlay (`ExtremeRow`/farthest `onClick`, `GeoExtremesCard.tsx:68-76`) also reads `.flown` so a clicked row never opens an empty overlay.
  - **Return type:** `{ global: { north, south, east, west }, byBase: Array<{ baseLabel, primaryCode, farthest, flightCount }> }` ranked by farthest. Resolve each `primaryCode` to coords (`lookupAirport` may be null → **skip that base**). Replace the hardcoded DFW `HOME` param. **`!hasHome` → omit the per-base ranking** (keep the global N/S/E/W block); never default to DFW.
  - **Card:** global N/S/E/W block on top (unchanged) + a "Farthest from each home" list — one compact row per base (`Dallas (DFW/DAL)` metro member-code label + farthest IATA/name + miles + flight-count chip), farthest-descending, reusing `ExtremeRow` click-through. Empty `homeHistory` ⇒ a single base ⇒ the list degenerates to today's single hero (backward-compat).
  - **Intended consequence:** the pre-first-era clamp credits a base for trips taken just before you moved there (a 2006 Tokyo trip credits your earliest base) — accepted for a "reach from each home" view.
  - **Tests are consumers:** `stats.test.ts:518-549` (old flat shape + `geoExtremes([])===null`) and `geoExtremes-card.test.tsx` must update; pin a backward-compat case (empty `homeHistory` ⇒ single-home flat-equivalent).
- **`byAirport` (`aggregate.ts:15`) + `AirportsCard.tsx:31-34` — relocate + rework.** `byAirport` has NO home logic; the real exclusion is a **card-level post-filter on all-time `settings.home` over deduped counts**. Move exclusion into `byAirport` as a **per-flight** drop via `homeAt(f.date)` set-membership; `AirportsCard` consumes that instead of post-filtering. (Spec previously mislocated this to `index.ts`.)
- **`domesticTierOf` (`stats.ts:174-180`).** Today checks only `f.from.region` against the single home region. Credit **intra-state only when the route's region equals `homeAt(f.date).primary`'s region**; define both-endpoint behavior. Test: `DFW→AUS` in 2012 with home = MKE must be **intra-country, not intra-state**.
- **`byCountry` (`stats.ts`) home-endpoint exclusion → date-aware**, set-membership, with the boundary-date rule. A pure connection through a co-home hub is **not** excluded (mirror trip rule 2).
- **`homeDistanceTiers`, `reconstructTrips`** → date-aware (per above).
- **`places.ts` `homeKey`/`displayRoute`** → date-less: use `homeKeys` set-union for home-first route ordering.
- **Cards:** HowFarFromHome, NightsAway, CommuterCadence, GeoExtremes, Airports (home-pill), Countries, **SuperDomestic** (region exclusion **and** the `Within <home state>` title `SuperDomesticCard.tsx:15` → multi-era copy, e.g. "Within your home state(s)").
- **`RouteMapV2` anchor:** all-time view rings the `homeKeys` union with the **current/most-recent** home emphasized; a year-scoped view emphasizes that era's home.
- **Guards:** the four trip cards + `reconstructTrips` `!settings.home` gates → `hasHome`.
- **Tests:** the four test `Settings` factories that enumerate fields (don't spread `DEFAULT_SETTINGS`) must add `homeHistory`/`groundLinks` — list them as consumers so they don't break on the new fields.

### Date-aware home exclusion (rankings)
The `excludeHomeFromRankings` toggle stays a single boolean. When ON, an endpoint is excluded from a ranking only when it was home **on that flight's date** (and not merely a connection through a co-home hub):
- RDU during college → excluded; RDU visited in 2020 → counts. ORD during the Milwaukee era → excluded; ORD as a 2020 connection → counts.
- `DFW→ORD` in 2012 credits Texas (ORD home); in 2020 credits Illinois (DFW home). Never inflates the then-current home region.
- Fixes a latent issue: a single home is excluded *all-time* today; date-aware means briefly-home hubs (ORD, LHR) aren't unfairly excluded across all history.
- **Pill copy:** "Home airports excluded for the years each was home" (hover → era list).

---

## Editor UI + Import/Export (Settings)

In `src/app/components/SettingsPanel.tsx`:
- **Homes:** add/remove/reorder eras (start date + airport multiselect with one primary + label). Live validation: ascending dates, ≥1 airport, warn on multi-group era.
- **Ground links:** add/remove rows; type a place → autocomplete nearest airport; mode dropdown; currency-if-price; optional fields collapsed.
- **Loader hardening (must-fix):** the CSV/localStorage **loader** — not just the editor — must **sort, de-dup (define the winner = last wins), and reject/merge zero-length or out-of-order eras**, because binary search assumes strictly-ascending non-degenerate intervals. On malformed import, fall back to `Settings.home` and **surface an error**, never silently mis-resolve.
- **Import/Export:** "Download my see-me-fly data" (date-stamped, `schema_version`ed CSVs). Import is **per-file and idempotent** with a **post-import summary** (rows added/updated, errors). Stored in localStorage alongside the flight CSV; account-sync is later.
- Ships EMPTY; single-`home` behavior remains the default when no eras exist.

---

## Phasing

- **Phase A (this build):** data model + `DEFAULT_SETTINGS`/versioning, `homeAt`/`hasHome`/`homeKeys`, the two branded CSVs (import/export/editor + loader hardening), all-time trip reconstruction with the unified movement stream + ground-link bridging/closing, era-correct migration of every consumer above, date-aware exclusion + pill. Vijay's own CSVs are DRAFTED BY CLAUDE from his history as importable files (his data, not the repo).
- **Phase B (assist — later):** **home-base detector** (anchor-shift → proposed eras) and **gap / missing-link finder** (arrival≠next-departure non-connections + non-closing trips → a checklist of candidate links). These *generate* a draft for a generic user to confirm.
- **Phase C (later):** ground links *filter into stats*; account sync; a *nights-spent* (time-on-ground) heatmap reimagining (the current heat mode is parked — every shading scheme so far just re-shows visit frequency).

---

## Non-Goals

- No change to flight counts, miles, durations, or any non-home-relative card.
- Ground links do not contribute to flight stats in Phase A.
- No automatic inference of homes or links in Phase A (Phase B).
- No backend/account in Phase A (localStorage; download/import is the portability path).
- Home-by-date leaves **local flights** (RPJ skydiving, `isLocalFlight`) untouched; a local flight at a then-home airport is date-aware-excluded from country credit only for its home era (one explicit behavior line).

## Open Items (resolve while seeding Vijay's data, not blocking the build)

- Vijay's exact era boundary dates (college terms, summers, Madrid summer, London fall, MKE 2012-07-03, back-to-Dallas 2013) — TBC against his flight data; the old seed in lifecoach `00-profile.md §8` is reference only.
- Near-airport choices for non-airport ground stops (e.g. Megabus NYC stop → LGA/EWR/JFK?).

## Residual minor review notes (handle in-build, not blocking)

- A tiny export manifest (export date + flight-row count + `schema_version`) would let a future column change anchor a migration and catch stale partial imports; optional in Phase A.
- Document explicitly that a `price` with no `currency` is never summed (already in the price/currency rule).
