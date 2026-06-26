# Flight Visualizer — Backlog & Feedback

Status: full app on `main` (engine + Pop theme + offline map). **`backlog-batch-1` branch** (2026-06-26) shipped the items below — 20 cards now (added Common Layovers), 243 tests, single-file 7.77 MB, offline-clean.

## ✅ Shipped in backlog-batch-1
Plan: `docs/superpowers/plans/2026-06-26-flight-visualizer-backlog-batch1.md`.
1. **Click-through to flight lists + Flight Detail (#1).** `OverlayProvider` stack (Esc/back, capped at 500 rows w/ note), generic `flight-filters.ts`, wired into Countries / Airports / Airlines / Routes / Layovers (→ flight list) and Shortest / Longest / Delays (→ single Flight Detail). Flight Detail shows tz-resolved local dep/arr times.
2. **Countries state split (#2).** US/IN/MX rows expand to their region (state) breakdown via BarList `subRows`.
3. **Home as a setting + universal home-first ordering (#3).** `Settings.home` (airport code, default `DFW`); `places.ts` `homeKey`/`displayRoute` lead with home for *undirected* routes only; drives farthest-from-home (`geoExtremes` takes home coords). Home picker in settings. "SF Bay" → "Bay Area".
4. **Metro names show member codes (#4).** `displayEndpoint` → "Dallas (DFW/DAL)" everywhere a metro appears (Routes/SuperDomestic/Intercontinental + Airports already did).
5. **"Show 10 more" + "Show all" (#5).** Plus "Show less", in BarList.
6. **Stable masonry (#6).** CardGrid uses JS height-aware columns with frozen per-card assignment — expanding a card grows only its column (no reshuffle). Recomputes only on viewport column-count change.
10. **Generic branding (#10).** User-facing copy says "flight logs CSV" (Dropzone prompt + validation error). Engine `REQUIRED_COLUMNS`/`parseFlightyCsv` unchanged internally.
- **NEW: Common Layovers card.** Engine `commonLayovers()` — a layover = a consecutive land-then-redepart at the same airport within `Settings.layoverMaxHours` (default 5h, configurable in settings). Uses new tz-resolved `EnrichedFlight.depUtcMs/arrUtcMs`.

## Still open
7. **Drag-to-reorder cards + persist layout** to localStorage. (Masonry now uses fixed columns, so a manual order would slot in.)
8. **Real airline logos** bundled (currently monogram circles + flag emoji).
9. **Hosted-website mode + live reference data.** Fetch airport/airline data from a live source instead of bundling `airports.json` (~6.3 MB) when network is available; keep bundled path for the offline single-file. Small `reference-source` adapter (bundled vs fetched).
11. **IATA metro-area codes to auto-build groups** (NYC/LON/CHI/WAS…) instead of the hand-curated `airport-groups.json`; reconcile with current curated groups; the live-DB adapter (#9) could supply it.

## Notes / levers
- **8 MB budget is self-imposed** (`scripts/preprocess/size-check.ts` `BUDGET_BYTES`). A `file://` HTML can be far bigger; or trim `airports.json` to IATA-only (~3 MB).
- Click-through flight lists cap at 500 rows (most-recent-first) with a "narrow the view" note — revisit with virtualization if needed.
- Carry-forwards: milestones at day-granularity could now use `depUtcMs` for sub-day precision; per-card aggregations recompute on render (fine at ~1,800 flights).
- Test infra: global env `node`; component tests `// @vitest-environment jsdom`; async FileReader tests need `waitFor`; a clickable BarList row + its sub-toggle both have role=button — query the toggle via `{ expanded }`.
