# Home-by-Date — Design Spec

**Status:** design approved in collaborative brainstorming (2026-06-29); pre-implementation. Built on the `home-by-date` branch; main is frozen at tag `v1.0.0`.

**Goal:** Replace the single `Settings.home` with a *time-aware* home so every home-relative statistic reflects where you actually lived **on each flight's date** — without changing any flight totals.

**Architecture:** A user-owned home timeline + a user-owned set of significant ground segments, both stored as branded CSVs in localStorage (downloadable; account-syncable later). A single `homeAt(date)` resolver threads date-aware home through ~14 existing consumers. Trip reconstruction gains ground-segment gap-closing. Nothing about any individual's life is hard-coded in the app.

---

## Global Constraints (bind every task)

1. **Flight COUNTS and DISTANCE TOTALS never change.** Home-by-date only affects *home-relative* outputs (farthest-from-home, nights-away, the close-to-home splits, trip reconstruction, map home-anchor, and home exclusion from rankings).
2. **No personal data in the app.** The app ships generic and empty. The home timeline and ground segments are USER DATA in localStorage, never in the repo or source.
3. **Branded filenames:** `see-me-fly_homes.csv`, `see-me-fly_links.csv`. Export button label: "Download my see-me-fly data" (date-stamped).
4. **Date-resolved, not year-resolved.** A single calendar year may contain multiple homes (2012 = RDU → Europe → Milwaukee). Home is keyed to the exact flight date. The year-scope dropdown stays independent of home.
5. **Backward compatible.** An empty home timeline behaves exactly like today's single `Settings.home`.
6. Stays offline / single-file / under the existing build conventions. Bundle-size budget is suspended by user direction until the app is "final."

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
- Empty `homeHistory` ⇒ fall back to the single `Settings.home` (backward compat).

**Serialized as `see-me-fly_homes.csv`:**
```
start_date,home_airports,label
2008-08-18,RDU,College — Durham
2009-05-15,DFW/DAL,Summer — Dallas
2012-07-03,MKE/ORD/MDW,Moved to Milwaukee
2013-01-15,DFW/DAL,Back to Dallas (present)
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
  arriveDate?: string      // for multi-day drives / overnight buses
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

**Serialized as `see-me-fly_links.csv`** with one column per field above (core first, then optional; blanks allowed).

**Role of ground links (Phase A):** they ONLY help **close trip gaps** in reconstruction. They do **not** add to any flight stat (counts, miles, airlines, etc.). "Can filter into stats later" is an explicit future phase.

---

## Home Resolution

A small `src/engine/home.ts`:
```ts
interface ResolvedHome { airports: string[]; primary: string }
function homeAt(date: string, settings: Settings): ResolvedHome | null
```
- Binary-search `homeHistory` for the era containing `date` (half-open intervals). Return `{ airports, primary: airports[0] }`.
- If `homeHistory` is empty, return `{ airports: [home], primary: home }` from `Settings.home` (or `null` if no home set at all).
- A flight ON a move date resolves to the NEW home (half-open `[start, …)`).

**"At home" semantics:**
- **Set membership** — an endpoint is "home" if its metro key matches ANY airport in that date's `ResolvedHome.airports` (compared via `airportKey(code, settings.groupAirports)`). Used for: trip boundaries, home-exclusion from rankings, the map home-anchor (ring all of that era's home dots), home-first route ordering, the Airports home-pill.
- **Single reference = `primary`** — for the two stats that need one point: `domesticTierOf` intra-state region (uses `primary`'s region) and `geoExtremes` farthest-from-home (distance from `primary`'s lat/lon).

---

## Trip Reconstruction (with ground links)

`reconstructTrips` today closes a trip when a leg ARRIVES home, and (recent fix) when a fresh leg DEPARTS from home. With home-by-date + links:

1. "Home" is evaluated per-leg via `homeAt(leg.date)` (set membership).
2. **A ground link lands you home** → close the trip. After a leg arrives at airport X, if a `GroundLink` with `fromAirport == X` (date ≥ that leg's date, within a small window) leads to a `toAirport` that is home on that date, the trip closes at the link.
3. **Connection vs arrival:** a same-day onward connection through a home airport (e.g. a connection at ORD during the Milwaukee era) must NOT close the trip. Reuse the existing layover detection (land-then-redepart within `layoverMaxHours`) — a quick redeparture is a connection, not "home."

**Worked example — the 2012 post-college Euro trip → move:**
`MCO→IAD→FRA→ISL→…→MUC→IAD→ORD→IAH` (May 26 – Jun 22), then a `drive IAH→MKE` link on **2012-07-03** (after a Houston wedding gap).
- The whole flight chain is one open trip (no home endpoint en route; ORD on Jun 22 is a same-day connection to IAH, not a close).
- The trip closes at IAH (last flight, Jun 22). The `IAH→MKE` drive on Jul 3 is a separate ground segment that moves home to Milwaukee — it does not retroactively fold into the flight trip. (A continuous fly-then-immediately-drive-home case WOULD close via rule 2.)

---

## Consumers to Migrate (date-aware home)

Thread `homeAt(flight.date, settings)` where `settings.home` is read today:
- `src/engine/stats.ts`: `domesticTierOf` (region uses era `primary`), `geoExtremes` (distance from era `primary`; its hardcoded DFW `HOME` constant becomes per-flight), `homeDistanceTiers`, `reconstructTrips`, `byCountry` (home-endpoint exclusion → date-aware).
- `src/engine/index.ts`: `byAirport` home exclusion → date-aware.
- `src/app/lib/places.ts`: `homeKey` → era-aware `homeKeys` for home-first route ordering.
- Cards: HowFarFromHome, NightsAway, CommuterCadence, GeoExtremes, MapV2/RouteMapV2 (anchor + home rings), Airports (home-pill), Countries/SuperDomestic (region exclusion + title).

### Date-aware home exclusion (rankings)
The `excludeHomeFromRankings` toggle stays a single boolean. When ON, a flight's endpoint is excluded from a ranking only when that endpoint was home **on that flight's date**:
- RDU during college → excluded; RDU visited in 2020 → counts.
- ORD during the Milwaukee era → excluded; ORD as a 2020 connection → counts.
- `DFW→ORD` in 2012 credits Texas (ORD was home); the same route in 2020 credits Illinois (DFW was home). Never inflates the then-current home region.
- This also fixes a latent issue: today a single home is excluded *all-time*; date-aware means briefly-home hubs (ORD, LHR) aren't unfairly excluded across all history.
- **Pill copy:** "Home airports excluded for the years each was home" (hover → era list).

---

## Editor UI (Settings)

A home-history + ground-links editor in `src/app/components/SettingsPanel.tsx`:
- **Homes:** add/remove/reorder eras (start date + airport multiselect with one marked primary + label). Live validation (ascending dates, ≥1 airport).
- **Ground links:** add/remove rows; type a place → autocomplete nearest airport; mode dropdown; optional fields collapsed by default.
- **Import / Export:** "Download my see-me-fly data" (date-stamped CSVs), and import to restore. Stored in localStorage alongside the flight CSV; account-sync is a later phase.
- Ships EMPTY. Existing behavior (single `Settings.home`) remains the default when no eras are defined.

---

## Phasing

- **Phase A (this build):** data model, `homeAt` resolver, `see-me-fly_homes.csv` + `see-me-fly_links.csv` (import/export/editor), era-correct migration of all consumers, date-aware exclusion + pill, ground-link gap-closing in trips. Vijay's own `homes.csv`/`links.csv` are DRAFTED BY CLAUDE from his history as importable files (his data, not the repo).
- **Phase B (assist — later):** help a generic user *generate* their data:
  - **Home-base detector** — finds the depart-from/return-to anchor over each stretch; a sustained anchor shift proposes an era boundary → a draft `homes.csv` to confirm.
  - **Gap / missing-link finder** — flags every spot where you land at one airport and your next flight departs a different one (not a quick connection), plus trips that won't "close" → a checklist of candidate ground links to confirm a mode or dismiss.
- **Phase C (later):** ground links *filter into stats*; account sync of all three data layers; a *nights-spent* (time-on-ground) heatmap reimagining (the current heat mode is parked — every shading scheme so far just re-shows visit frequency).

---

## Non-Goals

- No change to flight counts, miles, durations, or any non-home-relative card.
- Ground links do not contribute to flight stats in Phase A.
- No automatic inference of homes or links in Phase A (that is Phase B's assist).
- No backend/account in Phase A (localStorage only; download/import is the portability path).

## Open Items (resolve while seeding Vijay's data, not blocking the build)

- Vijay's exact era boundary dates (college terms, summers, Madrid summer, London fall, MKE 2012-07-03, back-to-Dallas 2013) — TBC against his flight data; the old seed in lifecoach `00-profile.md §8` is reference only.
- The few near-airport choices for non-airport ground stops (e.g. Megabus NYC stop → LGA/EWR/JFK?).
