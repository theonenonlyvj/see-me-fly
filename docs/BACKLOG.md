# Flight Visualizer — Backlog & Feedback (post Phase 2+3)

Status: full app built & merged to `main` (engine + Pop theme + 19 cards + offline map, 224 tests, single-file 7.76 MB). This file captures Vijay's feedback from 2026-06-26 to action next.

## Answer: the 8 MB limit
It's **self-imposed, not a real constraint.** I set a 4 MB "sanity ceiling" in the spec, then raised it to 8 MB when `airports.json` came in at 6.3 MB. A double-click `file://` HTML can be far bigger (browsers parse tens of MB fine; there's no network download). We can raise it to e.g. 15 MB, or trim `airports.json` (drop the smallest GA airports — the IATA-only subset is ~3 MB) if we want it lean. The build-time assertion lives in `scripts/preprocess/size-check.ts` (`BUDGET_BYTES`).

## NOW (Vijay wants these next)
1. **Click-through to flight lists (was deferred — now ACTIVATED).** Clicking an item — a country ("X flights in Italy"), an airport/metro, an airline, a route, a delayed/short/long flight — opens a popup/overlay listing the underlying flights, with a Flight Detail view. This is the original spec's Phase-2 interaction layer (airport popup + Flight Detail, §4.3.2 / §7): stacked overlays, Esc/back, virtualized/capped lists (a metro popup can be 1,400+ rows). Build the overlay model + a generic "flights list" popup driven by a predicate, then wire each card's rows to open it.

## QUICK FIXES (polish — do alongside)
2. **Countries card: DROP the state split.** Just countries (remove the US/IN/MX `regions` sub-breakdown from `CountriesCard.tsx`; the engine `byCountry` can keep `regions` unused or stop computing it).
3. **Dallas-first as a UNIVERSAL rule.** Any time a ROUTE is displayed on ANY card (Routes, Super-domestic, Intercontinental, Shortest, Longest, map labels/tooltips — "Close to home"/super-domestic notably doesn't), order endpoints so **Dallas (home) leads**. Extract a shared `displayRoute(key)`/`orderRouteEndpoints()` helper and use it everywhere a route key is rendered.
4. **Grouped-metro names always show member codes.** Wherever a metro NAME is shown (route endpoints, "where you land", etc.), include the airport code(s) in parens — e.g. "Dallas (DFW/DAL)", "London (LHR/LGW)". Today only the Airports card does this; make it a shared render helper used by all route/airport displays. (If a card just names the destination CITY, still append the code in parens.)
5. **"Show more" → two actions:** "Show 10 more" AND "Show all" (in `BarList.tsx`; currently a single "Show more (N)" that reveals everything).

## LAYOUT
6. **Masonry packing.** Cards should pack as TALL as possible (fill vertical space); expanding one card (Show all) currently triggers a silly full reshuffle. Keep column assignment stable on expand — likely move off naive CSS `column-count` (which reflows everything) to a JS/grid masonry that keeps each card's column and just grows it. "Most cards shown as high as possible, not a total reshuffle."

## NICE-TO-HAVE
7. **Drag-to-reorder cards + persist layout preference** (to localStorage settings). "Moving cards around dynamically could be nice."
8. Real airline LOGOS bundled (currently monogram circles + country-flag emoji).

## Carry-forwards from build (also in gitignored ledgers)
- Milestones order at day-granularity; carry `gateDepSched` onto `EnrichedFlight` for sub-day precision (spec §6.2).
- Per-card aggregations recompute on render (fine at 1,758 flights; memoize ctx if perf matters).
- Bundle is tight (7.76/8 MB) — see #1 answer for levers.
- Test infra: global env `node`; component tests `// @vitest-environment jsdom`; `src/test/setup.ts` has guarded RTL cleanup + Node-26 localStorage shim; async FileReader tests need `waitFor`.
