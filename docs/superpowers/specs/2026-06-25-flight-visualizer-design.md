# Flight Visualizer — Design Spec

**Date:** 2026-06-25
**Owner:** Vijay
**Status:** Approved design, pre-implementation

## 1. Purpose

A local, static tool that takes a [Flighty](https://flighty.com/) CSV export and renders a rich, visually-pleasing breakdown of personal flight history. It addresses gaps in how Flighty itself surfaces the data — chiefly the ability to **group nearby airports into metros** (so DFW/DAL read as "Dallas") and to view stats **all-time and year-by-year** with flexible route/airport identity rules.

Sample data: `lifecoach/ops/travel/reference/FlightyExport-2026-06-24.csv` (1,800 flights, 1997–2019, 161 unique airports).

## 2. Constraints & non-negotiables

- **Local-only, no server, no runtime network.** Deliverable is a single static `index.html` you double-click.
- **Point it at an export.** The user loads their own Flighty CSV at runtime (drag-drop / file picker). The CSV is *not* baked into the build.
- **Reference data is bundled** (baked into the build), so distances/countries/etc. work offline.
- **Extensible cards.** Adding or editing a card must be an isolated change (one module + one manifest line), so the user can grow the dashboard over time.

## 3. The data gap (why a reference layer is required)

The Flighty export contains only IATA airport codes and ICAO airline codes. It has **no** coordinates, distances, durations, countries, states, or continents, and no human airline names. Nearly every desired stat depends on enriching the raw rows from bundled reference datasets:

- **`airports.json`** — IATA → `{ name, city/municipality, lat, lon, iso_country, iso_region (e.g. "US-TX"), continent }`. Source: OurAirports (commercial airports; large + medium types plus any IATA present in real data).
- **`airlines.json`** — ICAO → airline name. Source: OpenFlights `airlines.dat`.
- **`airport-groups.json`** — curated, **user-editable** metro groupings (see §5).
- **`countries.json`** (optional helper) — ISO country code → display name + continent, if not fully derivable from OurAirports' `continent` field.

Distance = great-circle (haversine) between endpoint coordinates. Airports missing from the reference set are surfaced as "unknown" rather than silently dropped, and logged so the reference file can be patched.

## 4. Architecture

Single-page app, **Vite + React + Vitest**, built to one self-contained file via `vite-plugin-singlefile` (set Vite `base: './'`). Three layers:

### 4.1 Reference data layer
The three/four JSON files above, `import`ed as ES modules so they are inlined into the bundle at build time. **No runtime `fetch`** (which `file://` blocks). A small build/preprocess script (run during development, not at app runtime) generates `airports.json` and `airlines.json` from the upstream OurAirports / OpenFlights sources, filtered and trimmed to the fields we use.

### 4.2 Engine (pure functions, unit-tested)
Deterministic pipeline, no React:
1. **Parse** the Flighty CSV (robust to quoted fields, missing values, unsorted dates).
2. **Enrich** each flight: attach endpoint coordinates/country/region/continent; compute `distanceMi` (haversine); compute `durationMin` (actual takeoff→landing when both timestamps present, else estimate from distance using cruise speed + fixed taxi allowance); compute `delayMin` (actual vs scheduled gate arrival when available); resolve airline name; flag `canceled` / `diverted`.
3. **Filter** by active settings: scope (all-time / year), include-canceled, exclude-before-date.
4. **Normalize** routes/airports through the identity settings (§5.2).
5. **Aggregate** into the stats each card consumes.

The engine exposes the enriched + filtered + normalized flight set and a set of aggregate helpers; cards consume these and never re-parse.

### 4.3 UI layer
- **Top bar:** scope dropdown (All-time + one entry per year present), settings toggle.
- **Settings panel** (§5.1).
- **Card grid:** responsive grid of card modules.
- **Flight Detail view** (§7), opened from any flight in any list/popup.
- **Card registry** (§8) drives what renders.

State (settings) persists in `localStorage`. Any settings change recomputes all cards live.

## 5. Settings & the identity engine

### 5.1 Settings panel
- **Group airports** (bool, default on) + a **"view groupings"** expander listing every active group and its member airports.
- **Explicitly unique** (bool). When **on**, `A→B` and `B→A` are different routes. When **off**, they collapse to one undirected route.
- **Include canceled flights** (bool, default off). When off, canceled flights are excluded from all stats; diverted flights always count, attributed to their actual destination.
- **Exclude flights before [date]** (configurable date, default off). Hides pre-cutoff placeholder/stub rows from every card. Temporary convenience while old flight details are being chased down.

All persist in `localStorage`.

### 5.2 Normalization rules
For any route **A→B**, applied in order:
1. **Group airports** on → each endpoint becomes its metro group (DFW→"Dallas"); off → stays itself.
2. **Explicitly unique** off → sort the (possibly grouped) pair into a canonical order so direction collapses; on → keep direction.

Worked example, Group **on** + Unique **off**: `DFW→SFO`, `OAK→DAL`, and `SFO→DFW` all collapse to a single route **{Dallas ↔ SF Bay}**.

**Grouping is global.** When on, every airport-keyed stat (unique-airports count, airport card, routes, etc.) counts by group; the airport popup shows the group, then lists member airports beneath.

**Overview-card exception:** the overview card's **Unique Airports** and **Unique Routes** are always plain distinct counts — grouping still applies, but the explicitly-unique/direction toggle does **not** affect them (a "unique route" there is inherently undirected). They have no click-through.

## 6. Cards (v1)

Two families. All "list of specific flights" surfaces click through to the Flight Detail view (§7).

### 6.1 Core stat cards (the original 10)
1. **Overview** — # flights, total distance, total time in flight, unique airports, # airlines, # unique routes. (Unique counts per §5.2 exception.)
2. **Distance buckets** — count of flights per distance band. Seed bands (tunable): `<300 / 300–700 / 700–1,500 / 1,500–3,000 / 3,000–6,000 / 6,000+ mi`, with playful labels. (More nuanced than domestic/international — e.g. DFW–CUN reads shorter than SFO–JFK.)
3. **Shortest flights** — toggle time/distance; top 5 with "show more"; click-through.
4. **Longest flights** — same as #3.
5. **Airports** — most-visited top 10 + show more; click an airport → popup listing flights touching it (→ click-through). Respects grouping.
6. **Airlines** — most-flown top 5 + show more.
7. **Routes** — toggle sum-of-miles / # flights; the grouping + direction rules make this the centerpiece of the stat cards.
8. **Countries** — top 10 + show more; **US split by state**; also split other countries by sub-region if any are frequented enough to be interesting.
9. **Super-domestic** — routes whose endpoints stay within the same region, tiered: intra-state → intra-country → intra-continent, ranked.
10. **Intercontinental** — routes crossing continents, ranked.

### 6.2 Creative cards (v1 selections)
- **🗺️ The Map** — world map, great-circle route arcs, thickness/opacity = frequency. Hero visual.
- **🌍 Around-the-world odometer** — total miles expressed as ×-around-the-Earth (24,901 mi) and % to the Moon (238,900 mi). (Exact framing metrics to be tuned after build.)
- **📅 Travel intensity heatmap** — GitHub-style calendar of flights per month/year.
- **🏆 Records & streaks (easy stats only, v1)** — most flights in a single day, busiest month, busiest year, longest grounded gap, milestone flights (100th / 500th / 1,000th, click-through). *Backlogged (harder): redeyes, longest multi-segment single trip — connection detection is fiddly given frequent day-trips.*
- **🧭 Geographic extremes** — northern/southern/eastern/western-most airport, farthest from home (DFW), travel bounding box.
- **⏰ When you fly** — **departure-hour and arrival-hour heatmaps** (no day-of-week — too flat to be interesting).
- **✈️ Aircraft** — aircraft types ranked, rarest type, widebody/narrowbody/prop split.
- **🔧 Same Metal (tail numbers)** — top tail numbers by # flights on that *physical* aircraft; click a tail → every route/flight flown on it (→ click-through). Caveat: Tail Number is blank on many older rows, so it ranks only recorded tails.
- **😤 Delay leaderboard** — scheduled vs actual times → real delay minutes; most-delayed flights, on-time %, cancellations survived, diversions. Pairs with the include-canceled toggle.

### 6.3 Backlog (parked, not v1)
- **Cabin & seat** — unreliable: 2017–2021 frequently flew first but booked main cabin, so recorded cabin is wrong.
- **Reason split** (business/personal/commute) — flights aren't tagged.
- **Auto-suggest groupings** — propose airports within N miles for the user to accept into `airport-groups.json`.
- Harder Records stats (above).

## 7. Flight Detail view

Opened from any flight in any list/popup. Shows: date, airline + flight number, route (with a small map snippet of that single arc), aircraft type, tail number, seat/cabin, scheduled-vs-actual times + computed delay, distance, duration, PNR, notes, and canceled/diverted status.

## 8. Extensibility (card registry)

A `cards/` directory holds one module per card. Each module exports a small contract — e.g. `{ id, title, group: 'core'|'creative', render(ctx) }` — where `ctx` provides the enriched/filtered/normalized flight set and aggregate helpers from the engine. A manifest array lists the active cards in display order. **Adding a card = new module + one manifest line.** No engine or shell changes required for a card that uses existing enriched data.

## 9. Airport groupings (seed content)

`airport-groups.json` ships with named metro groups — thorough on US metros, major metros abroad, **commercial airports only**. Confirmed groups present in the sample data:

| Group | Airports |
|---|---|
| Dallas | DFW, DAL |
| Houston | IAH, HOU |
| New York | JFK, LGA, EWR |
| Washington DC | IAD, DCA, BWI |
| Chicago | ORD, MDW |
| SF Bay | SFO, OAK, SJC |
| Los Angeles | LAX, BUR, SNA, (ONT, LGB) |
| South Florida | MIA, FLL, (PBI) |
| London | LHR, LGW, STN, LTN, LCY, (SEN) |
| Boston | BOS, PVD, (MHT) |
| Rio Grande Valley | HRL, BRO, MFE |

Plus additional well-known world metros not yet in the user's data (Tokyo HND/NRT, Paris CDG/ORY, Seoul ICN/GMP, Milan MXP/LIN/BGY, São Paulo GRU/CGH/VCP, Moscow SVO/DME/VKO, Rome FCO/CIA, etc.). Every group is user-editable JSON; the settings panel renders the active set.

## 10. Testing

Engine is pure and unit-tested (Vitest): CSV parsing edge cases, haversine distances against known values, duration estimation/fallback, canceled/diverted handling, the normalization engine across all four group×unique combinations, and per-card aggregation. UI is thin over a tested engine.

## 11. Open items to tune post-build
- Exact odometer framing metrics (card 🌍).
- Distance bucket boundaries/labels (card 2).
- Whether any non-US country warrants sub-region splitting in the Countries card.
