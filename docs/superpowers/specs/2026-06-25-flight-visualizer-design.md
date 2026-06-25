# Flight Visualizer — Design Spec

**Date:** 2026-06-25
**Owner:** Vijay
**Status:** Approved design, hardened by adversarial review (v2), pre-implementation

> v2 incorporates a 6-lens adversarial completeness review (58 raw findings → ~25 patches) run against the real sample CSV. All measured facts below are from that export.

## 1. Purpose

A local, static tool that takes a [Flighty](https://flighty.com/) CSV export and renders a rich, visually-pleasing breakdown of personal flight history. It addresses gaps in how Flighty itself surfaces the data — chiefly the ability to **group nearby airports into metros** (so DFW/DAL read as "Dallas") and to view stats **all-time and year-by-year** with flexible route/airport identity rules.

Sample data: `lifecoach/ops/travel/reference/FlightyExport-2026-06-24.csv` — **1,800 flights, 1991–2026 (incl. ~12–14 future-dated rows through 2026-08), 23 distinct years, 161 unique airports.**

## 2. Constraints & non-negotiables

- **Local-only, no server, no runtime network.** Deliverable is a single static `index.html` you double-click. No tile servers, no CDN, no remote fonts, **no `fetch` at runtime**.
- **No web workers.** They can't be spawned from inlined/blob scripts under `file://`. The engine runs synchronously on the main thread (1,800 rows is trivial). If PapaParse is used, set `worker: false`.
- **Point it at an export.** The user loads their own Flighty CSV at runtime (drag-drop / file picker). The CSV is *not* baked into the build, and (per `file://`) is *not* re-readable after refresh — see §4.3.1.
- **Reference data is bundled** (baked into the build), so distances/timezones/countries/etc. work offline.
- **Extensible cards.** Adding or editing a card must be an isolated change (one module + one manifest line).

## 3. Reference-data layer (bundled, baked into build)

The Flighty export contains only IATA airport codes and ICAO airline codes — **no** coordinates, distances, durations, timezones, countries, states, continents, or human names. Everything is derived from bundled reference files, imported as ES modules (no runtime fetch). A **preprocess script** (dev-time, not app runtime) generates these from upstream sources and emits a **coverage report** of any unmatched codes.

### 3.1 `airports.json` — IATA → record
- **Source:** OurAirports. **Row-trim:** include **every row with a non-empty IATA code, plus every row whose `local_code` (FAA) or `ident` (ICAO) could be a Flighty code** — i.e. keep small GA fields too (still well under budget). The runtime CSV's airports are unknown at build time, so we can't trim to the user's set.
- **Fields kept:** `{ iata, localCode, ident, name, municipality, lat, lon, iso_country, iso_region, continent, tz }`.
- **Resolution order (engine):** a CSV airport code resolves by **IATA → FAA `local_code` → ICAO `ident`** (try `ident` both as-is and with a leading `K`/`C` stripped). This resolves general-aviation codes Flighty emits as FAA IDs.
- **`tz`** = IANA/Olson string (e.g. `America/Chicago`), computed at preprocess from `lat`/`lon` via a coordinate→timezone-boundary lookup (e.g. `tz-lookup` / timezone-boundary-builder). **Not** from OpenFlights `airports.dat` (stale; missing tz for airports the user flies — DOH, HYD, GOX).
- **Unresolved airports:** with the local_code/ident fallback, **RPJ resolves to Rochelle Municipal, IL** (`KRPJ`, blank IATA) — it is a real airport, not unknown. Expect **near-zero true unknowns**; any that remain are logged (not dropped) and surfaced in a badge (§4.4).

### 3.2 `airlines.json` — ICAO → name
- **Source:** OpenFlights `airlines.dat` (full ICAO→name map; small).
- **The CSV's `Airline` column is ICAO** (3-letter: `AAL`, `JAL`…), confirmed against the data.
- **Collision dedup:** `airlines.dat` is keyed by sequential id with repeating/blank ICAO codes. When several rows share an ICAO, the preprocess picks deterministically: prefer `active=Y`, then a canonical non-"Domestic" name, then lowest id (e.g. `JAL`→"Japan Airlines"). Log collisions.
- **Override map (bundled):** seed known misses absent from `airlines.dat` — `JSX`, `NOZ` (Norse), `BEL` (Brussels), `JLL`, plus defunct `AWE`, `COA`, `VRD`. Editable.
- **Fallbacks:** an ICAO with no match renders the **raw ICAO** as label (flight not dropped). A blank `Airline` renders **"Unknown airline"**.

### 3.3 `airport-groups.json` — curated, user-editable metro groups (§9)

### 3.4 `regions.json` — ISO region/country display names
- **Source:** OurAirports `regions.csv` (+ a small country-code→name map; OurAirports gives only the `iso_country` *code*).
- Maps `iso_region` (e.g. `US-TX`, `IN-TN`, `MX-CMX`) → human name for the Countries card. **Normalize deprecated codes** (`MX-DIF` → `MX-CMX` "Ciudad de México") so MEX reads "Mexico City / CDMX", not a raw code.

### 3.5 `aircraft-classes.json` — type-name → body class
- Substring/regex rules mapping free-text `Aircraft Type Name` (52 distinct values, no body-type column in the data) → `wide | narrow | regional | prop`, with an **`unclassified`** bucket for unmapped names. Regional jets (CRJ/Embraer, ~290 flights) are their **own bucket**.

### 3.6 `flight-overrides.json` — per-flight manual corrections (user-editable, durable)
A bundled, editable list of corrections **keyed by a stable signature** = `Date|From|To|Gate Departure (Scheduled)` (the `Flight Flighty ID` is unreliable — **45/1,800 rows have it blank**, including the RPJ flight, so it can't be the key). Each entry may patch: `durationMinOverride`, `distanceMiOverride`, `from`/`to`, `exclude` (bool), and a `note`. Applied during enrich, **after** automatic enrichment but before aggregation. Because the signature recurs across exports, an override **persists when a new Flighty export is loaded** — the place to record recurring Flighty bugs.
- **Seeded entry — the RPJ skydiving flight** (`2013-08-18|RPJ|RPJ|2013-08-18T12:00`): a DHC-6 Twin Otter jump flight that takes off and lands at Rochelle, IL. With the §4.2/§4.4 local-flight handling it already reads ~20 min and counts as a real flight; the seed entry pins a `note` documenting the recurring "same-airport, zero-mile" Flighty quirk so future exports stay correct.

### 3.7 Bundle budget
`vite-plugin-singlefile` inlines all assets into one HTML doc with no code-splitting. **Raw `index.html` budget: < 4 MB.** A build-time assertion fails the build if exceeded. (~9k trimmed airports + small airline/region/aircraft maps + ~100 KB world TopoJSON fit comfortably.)

## 4. Architecture

Single-page app, **Vite + React + Vitest**, built to one self-contained file via `vite-plugin-singlefile` (`base: './'`). Layers: reference data (§3) → engine (§4.2/4.4) → UI (§4.3).

### 4.1 Visualization library (pinned)
**D3** is the only viz dependency: `d3-geo` + `topojson-client` for the map; hand-rolled SVG for bar / calendar-heatmap / hour-heatmap charts. One dependency, no runtime assets, tree-shakeable, no workers, works under `file://`. **Forbidden:** Leaflet, Mapbox GL, Google Maps, or any lib that lazy-loads tiles/assets/fonts or uses workers.

### 4.2 Engine (pure functions, unit-tested, synchronous)
Deterministic pipeline, no React:

1. **Parse** the Flighty CSV (PapaParse `worker:false`, or equivalent): robust to quoted fields, missing values, unsorted dates, and **both timestamp formats** — `YYYY-MM-DDTHH:mm` (older rows) and `YYYY-MM-DDTHH:mm:ss` (2022–23 rows), ISO with **no offset, treated as local wall-clock**. A single hardcoded pattern would NaN an entire era.
2. **Enrich** each flight:
   - Resolve endpoints to airport records; attach coords/country/region/continent/tz. Resolve airline name (§3.2).
   - `distanceMi` = great-circle (haversine) between endpoints. `null` if an endpoint is unresolved (§4.4).
   - **`durationMin` (timezone-aware, fallback chain):** each timestamp is localized using its endpoint airport's `tz` + the flight date (DST-correct), converted to **UTC**, then subtracted. **Never emit a negative duration** (clamp + flag). Resolution order, first available wins:
     1. **Actual** takeoff→landing (true air time). [best; ~91% of rows]
     2. **Scheduled** takeoff→landing.
     3. **Gate-to-gate** (actual, else scheduled) **minus a taxi allowance** (`gateTaxiMin ≈ 10`), clamped to ≥ `localFlightMinMin`. Helps the **143 rows** with gate times but no air-times.
     4. **Distance estimate:** `durationMin = taxi + (distanceMi / cruiseMph)*60 + climbDescent`, with **`cruiseMph ≈ 500`, `taxi ≈ 30`, `climbDescent ≈ 15`** min.
     - **Zero-distance local flights** (`distanceMi == 0`, From==To — see §4.4): skip step 4 (the formula is meaningless); use steps 1–3, else a `localFlightDefaultMin ≈ 20`. The seeded RPJ jump flight resolves at **step 3** (gate 12:00→12:30 = 30 min − 10 taxi ≈ **20 min**), no hardcoding.
     - All five constants live in **Advanced settings** (§5.1) and are tunable; tz-fallback and estimate rows are logged.
   - Keep **both** the raw-local and UTC-resolved timestamps on the enriched object (the hour-heatmaps want raw local; duration wants UTC — §6.2).
   - **`delayMin`** = `Gate Arrival (Actual) − Gate Arrival (Scheduled)` (both at the same arrival airport → tz-safe, independent of the duration tz problem). Available for ~1,646/1,800 rows. `null` when actual gate arrival is blank (incl. most canceled/diverted).
   - **`flown`** flag = `has actual times OR date ≤ today`. Future-dated rows (date > today, ~12–14 rows, empty actuals) are **not flown**.
   - Flags: `canceled`, `diverted` (+ effective destination, §4.4).
3. **Filter** by active settings: scope (all-time / year), include-canceled, exclude-before-date, and **flown-only by default** (upcoming rows excluded from flown-stats).
4. **Normalize** routes/airports through the identity settings (§5.2).
5. **Aggregate** into per-card stats via shared, memoized helpers (§8).

### 4.3 UI layer
- **Top bar:** scope dropdown + settings toggle.
- **Scope dropdown:** "All-time" (default) + one entry per year **present in the post-filter set**, ordered **descending**. A year with zero remaining flights after exclusions disappears from the list.
- **Settings panel** (§5.1), **card grid** (§6), **Flight Detail** + **airport popup** overlays (§4.3.2, §7).

#### 4.3.1 Load states
- **Empty/welcome state:** before any file is loaded, the **dropzone is the hero**. On refresh the app returns here (settings persist in localStorage; data does not — `file://` can't re-read the last file), so the dropzone must always be reachable.
- **Header validation:** validate the parsed header against the expected Flighty column schema; a non-Flighty/malformed/empty CSV shows a **named error** listing missing/unexpected columns.
- **Replace file:** an affordance to load a different export; **keeps settings, resets scope to All-time**.

#### 4.3.2 Navigation / overlay model
- Flight Detail and the airport popup are **stacked overlays**. Order: Flight Detail closes back to the popup that opened it; popup closes back to the grid. **Esc** closes the top layer; **focus returns** to the trigger element; focus is trapped within the open overlay.
- **No per-flight deep-linking** (file:// + non-persistent data make shareable URLs non-restorable). Overlay state is in-memory; refresh → empty state.

### 4.4 Edge-case semantics (engine rules)
- **Unresolved endpoint:** `distanceMi = null`; **excluded** from distance/duration/route/geo aggregates and from unique-airport/route counts; surfaced in a visible "unresolved" badge/log. Still appears as a row where a raw listing is shown. (With §3.1's local_code/ident fallback this should be near-empty.)
- **`From == To` = a legitimate "local flight"** (skydiving, scenic, training, ferry-return — e.g. the RPJ jump flight). It **counts** as a flight, a per-airport/group touch, and toward total time-in-flight (duration via the §4.2 local-flight path, `distanceMi = 0`). It is **excluded only** from route-keyed and distance-based aggregates where it would distort them: routes, super-domestic, intercontinental, unique-routes, map arcs (draws no arc), and **shortest/longest *by distance*** (0 mi would always win). It **may** appear in shortest/longest *by time*. Guard haversine/per-mile math against zero. This applies to raw From==To **and** pairs collapsed by grouping (DAL↔DFW → Dallas→Dallas). A truly empty junk row (no times, no aircraft) still just contributes 1 flight + 1 touch; use `flight-overrides.json` `exclude` to drop a specific bad row.
- **Diverted flight:** when `Diverted To` is non-blank, **effective `To` = Diverted To** for **all** airport/route/distance/geo aggregation (route `From→DivertedTo`, distance to the diverted endpoint — consistent with the truncated-leg timestamps, arrival credit to DivertedTo). The original scheduled `To` is preserved **only** in Flight Detail as "intended destination." `delayMin = null` when actual gate arrival is blank (true for 2 of 3 diverted rows). The 3 confirmed diverted rows divert to AUS/LBB/SPS.

## 5. Settings & the identity engine

### 5.1 Settings panel (persisted in localStorage)
- **Group airports** (bool, default **on**) + a **"view groupings"** expander.
- **Explicitly unique** (bool, default **off**) — direction handling per §5.2.
- **Include canceled flights** (bool, default **off**). When on, canceled flights (30 rows, all with zero actuals) count toward flight count, the "cancellations" metric, and route/airport touches, but contribute **0 distance and 0 time**, and `delayMin = null`.
- **Exclude flights before [date]** (configurable, default **off**). Hides pre-cutoff placeholder/stub rows from every card. (Temporary; old flights being chased down.)
- **Reset to defaults** affordance.
- **Advanced (collapsed)** — duration-estimate constants, editable: `cruiseMph` (500), `taxi` (30), `climbDescent` (15), `gateTaxiMin` (10), `localFlightDefaultMin` (20) / `localFlightMinMin`. These affect only estimated/fallback durations (§4.2); changing them recomputes live.

**View-groupings expander** shows only **active groups** = groups with ≥1 member airport present in the currently loaded+filtered set (with a count), plus an optional "show all bundled groups" toggle. Before a file is loaded it shows a placeholder.

### 5.2 Normalization rules
For any route **A→B**, applied in order:
1. **Group airports** on → each endpoint becomes its metro group (DFW→"Dallas"); off → stays itself.
2. **Explicitly unique** off → sort the (possibly grouped) pair into canonical order so direction collapses; on → keep direction.

Worked example, Group **on** + Unique **off**: `DFW→SFO`, `OAK→DAL`, `SFO→DFW` all collapse to **{Dallas ↔ SF Bay}**.

**Grouping is global.** When on, every airport-keyed stat counts by group; the airport popup shows the group, then lists member airports.

**Overview-card exception:** the overview's **Unique Airports** and **Unique Routes** are always plain distinct counts — grouping applies, but the explicitly-unique/direction toggle does **not** affect them. No click-through.

## 6. Cards (v1)

All "list of specific flights" surfaces click through to Flight Detail (§7), and obey degenerate-state rules: a list with `<N` items shows what exists without padding; when shortest==longest, render one entry; a card with 0 qualifying items shows a **one-line empty message**, not blank.

### 6.1 Core stat cards (the original 10)
1. **Overview** — # flights, total distance, total time in flight, unique airports, # airlines (excludes "Unknown" from the distinct count), # unique routes. (Unique counts per §5.2 exception.)
2. **Distance buckets** — count per band. Seed bands (tunable; data is bottom-heavy — ~48% < 300mi, so the §11 tuning pass should split the short end / use quantile bands): `<300 / 300–700 / 700–1,500 / 1,500–3,000 / 3,000–6,000 / 6,000+ mi`, playful labels.
3. **Shortest flights** — toggle time/distance; top 5 + show more; click-through.
4. **Longest flights** — same.
5. **Airports** — most-visited top 10 + show more; click → popup of flights touching it. Popup contract: **reverse-chronological**, initial cap (show 20 + "show more"), **virtualized or capped with a count badge** (e.g. "965 flights — showing 20"); applies equally to grouped-airport popups (Dallas = 1,457 flights). Respects grouping.
6. **Airlines** — most-flown top 5 + show more.
7. **Routes** — toggle sum-of-miles / # flights; grouping + direction rules make this the centerpiece.
8. **Countries** — top 10 + show more; **US, India, and Mexico split by state/region** (via `iso_region`, named through §3.4); all other countries shown whole.
9. **Super-domestic** — routes whose endpoints stay within the same region, tiered: **intra-state** (same `iso_region`) → **intra-country** (same country **and** same continent) → **intra-continent** (same continent, different country), ranked.
10. **Intercontinental** — routes whose endpoints are on **different continents**, ranked.

   **Classification is continent-first** and the tiers are mutually exclusive: a route is intercontinental iff its two endpoints differ in `continent`. **Decided: Hawaii (HNL, continent `OC`) is international/intercontinental** — so HNL↔mainland (NA) is intercontinental and is **not** counted as intra-USA super-domestic. (Same logic makes Guam intercontinental and Anchorage intra-USA.)

### 6.2 Creative cards (v1)
- **🗺️ The Map** — drawn from **bundled world TopoJSON** (world-atlas `countries-110m`, ~100 KB, ES-module import) with D3 `geoNaturalEarth1`; great-circle arcs via `d3.geoInterpolate`, thickness/opacity = route frequency. **Antimeridian-crossing arcs** (DFW↔SIN/TPE/KUL) clipped/split at ±180°. No tiles.
- **🌍 Around-the-world odometer** — total miles as ×-around-Earth (24,901 mi) and % to the Moon (238,900 mi). Uses flown-only distance. (Exact framing tuned post-build.)
- **📅 Travel intensity heatmap** — GitHub-style calendar, flights per month/year.
- **🏆 Records & streaks (easy stats only, v1)** — most flights in a single day, busiest month, busiest year, longest grounded gap, **milestone flights (100th / 500th / 1,000th)**. Milestones are computed over the full **non-canceled, flown** set ordered by the best-available departure timestamp (`Gate Departure (Scheduled)` || `Take off (Scheduled)` || `Date`) ascending, with **original CSV row index** as the final deterministic tiebreak (**not** `Flight Flighty ID` — 45/1,800 rows have it blank). Computed **before** scope/exclude-before-date filtering (card may note the active cutoff) so a year scope doesn't hide the 1,000th. *Backlogged: redeyes, longest multi-segment trip (connection detection).*
- **🧭 Geographic extremes** — northern/southern/eastern/western-most airport, farthest from **home (Dallas metro)** (a single config constant), travel bounding box.
- **⏰ When you fly** — departure-hour and arrival-hour heatmaps using the **raw local timestamp as-stored** (no tz conversion — that's the correct frame). (No day-of-week — too flat.)
- **✈️ Aircraft** — types ranked, rarest type, **wide/narrow/regional/prop split** via `aircraft-classes.json`; 47 blank-type rows excluded from the split → "unclassified". Caveat: 11 "Helio H-500 Twin Courier" rows are a Flighty mislabel for AAL mainline transcons.
- **🔧 Same Metal (tail numbers)** — "aircraft you rode more than once": tails with **≥2 flights** (~309 qualify), tiebreak most-recent-flight then tail string; click a tail → every flight on that physical aircraft (→ click-through). Caveat: tail data is recorded **from ~2013** (0% before), ~86.5% overall — the card notes "based on N of M flights."
- **😤 Delay leaderboard** — `delayMin` per §4.2; most-delayed flights, **on-time %** (threshold 15 min; denominator = flights with both gate-arrival timestamps, ~1,646; surface the excluded count), cancellations survived, diversions.

### 6.3 Backlog (parked, not v1)
- **Cabin & seat** — **blocked, not merely unreliable:** Cabin Class / Seat Type / Reason / Notes are **0% populated** in this export (Seat 21%, PNR 41%, Tail 86.5%).
- **Reason split** — 0% populated.
- **Auto-suggest groupings** — propose airports within N miles to accept into `airport-groups.json`.
- Harder Records stats (redeyes, multi-segment trips).

## 7. Flight Detail view

Opened from any flight list/popup. **Empty-field rule:** a field with no value is **omitted** (never shown as a blank label); rarely-populated fields (seat/cabin/PNR/notes) live in a section that **hides entirely when all are empty**; date/route/airline always show. When Airline **and** Flight number are both blank (5 oldest rows), the label falls back to `DATE — FROM→TO` and airline resolves to "Unknown airline".

Shows (when present): date, airline + flight number, route (with a small bundled-vector map snippet of that arc), aircraft type + class, tail number, computed distance, computed duration, scheduled-vs-actual times + `delayMin`, PNR, notes, and status. **Upcoming** rows get an "Upcoming" badge with duration/delay shown as "—". **Diverted** rows show "intended destination" alongside the actual.

## 8. Extensibility (card registry & ctx contract)

`cards/` holds one module per card; a manifest array lists active cards in display order. **Adding a card = new module + one manifest line.**

Each card exports `{ id, title, group: 'core'|'creative', settings?, render(ctx) }`:
- **`ctx`** (built once per `(settings, scope)` change, **memoized**, shared across all cards — never re-aggregate 1,800 rows per card per keystroke) exposes the normalized flight array + named aggregate helpers: `byAirport`, `byRoute`, `byAirline`, `distanceBuckets`, `byYear`, plus the unresolved/upcoming sets.
- **`settings`** = optional declarative descriptor for the card's own toggles (e.g. miles/#flights for Routes, time/distance for Shortest), backed by a namespaced `useCardState` helper.
- Standard **"show more"** and **empty-state** conventions provided by a shared card frame.

### 8.1 localStorage contract
Single namespaced key **`flightviz:settings:v1`**; documented JSON shape `{ schemaVersion:int, global:{…}, cards:{ [cardId]: {…} } }`. Load path **deep-merges over current defaults** (fills missing keys) and runs **ordered migrations** when `schemaVersion` is behind. A stale blob must never break a returning user as the settings surface grows.

## 9. Airport groupings (seed content)

`airport-groups.json` ships with named metro groups — thorough on US metros, major metros abroad, **commercial airports only**. Confirmed groups present in the sample:

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

Plus additional well-known world metros not yet in the user's data (Tokyo HND/NRT, Paris CDG/ORY, Seoul ICN/GMP, Milan MXP/LIN/BGY, São Paulo GRU/CGH/VCP, Moscow SVO/DME/VKO, Rome FCO/CIA, etc.). All user-editable; the settings panel renders the active set (§5.1).

## 10. Testing

Engine is pure and unit-tested (Vitest). **Golden fixture:** a ~12-row synthetic CSV with hand-computed expecteds/tolerances:
1. **DFW→ORD** great-circle ≈ **802 mi** (±0.5%).
2. A **tz-crossing** flight (e.g. westbound CLT→DFW, naive = −77 min) asserting a correct **positive** duration.
3. A **missing-takeoff-actual** row asserting the distance estimate using the pinned cruise/taxi constants.
4. A **canceled** and a **diverted** row asserting attribution (→AUS/LBB/SPS) and `delayMin=null`.
5. The **§5.2 worked example** asserting all four group×unique route counts.
6. An **FAA-code airport** (e.g. `RPJ`) resolves via `local_code` fallback (not surfaced as unknown); a genuinely **unknown** code is surfaced, not dropped.
7. The **RPJ From==To local flight** asserts: counts as 1 flight + 1 RPJ touch, `distanceMi == 0`, duration ≈ **20 min** (gate-to-gate fallback), excluded from routes / shortest-by-distance / map arcs.
8. A **`flight-overrides.json`** entry (by signature) patches a row and **survives a re-parse**.
9. **HNL↔DFW** classifies as **intercontinental** (continent NA vs OC), not intra-USA.
10. **Both timestamp formats** (minute + second precision) parsed.
11. **Departure-hour** equals the literal CSV hour (raw-local frame).
12. **MEX** renders "Mexico City / CDMX" (not `MX-DIF`); a **blank-`Flight Flighty ID`** row still orders deterministically (milestone tiebreak).

UI is thin over the tested engine.

## 11. Build phasing & v1 acceptance

**Phasing** (yields something runnable early):
- **Phase 0** — preprocess script + the 6 reference files (airports, airlines, groups, regions, aircraft-classes, flight-overrides — the last is seeded at `reference/flight-overrides.json`) + their tests + the golden fixture.
- **Phase 1** — engine + Overview / Distance / Airports / Airlines / Routes + scope/settings; **runnable on the real CSV**.
- **Phase 2** — remaining core cards (Countries / Super-domestic / Intercontinental / Shortest / Longest) + Flight Detail + airport popup.
- **Phase 3** — creative cards; **the Map last**, behind an offline-render spike.

**v1 acceptance — done when:**
- The golden suite passes.
- The real CSV loads with **every airport/airline resolved or explicitly logged** (near-zero unknowns; with the local_code/ident fallback even RPJ resolves).
- Phase-1 cards render correct totals; settings persist and recompute live.
- `index.html` opens via `file://` with **no network calls**, within the size budget.
- *(Ship-blocking cards: the 10 core + Map, Odometer, Heatmap, Records, Geo-extremes, When-you-fly, Aircraft, Same Metal, Delay. All 19 are v1.)*

**Post-build tuning knobs:** odometer framing metrics; distance-bucket boundaries/labels (account for the <300mi skew). *(Resolved: duration-estimate constants now live in Advanced settings §5.1; HNL/Hawaii is intercontinental §6.1.)*
