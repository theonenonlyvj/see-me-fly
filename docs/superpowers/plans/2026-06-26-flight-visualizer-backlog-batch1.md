# Flight Visualizer — Backlog Batch 1 Implementation Plan

> Executed via subagent-driven development on branch `backlog-batch-1`. Source of truth for the work resuming `docs/BACKLOG.md` after the 2026-06-26 compaction.

**Goal:** Land the high-priority backlog items + a new **Common Layovers** card, in dependency order, each task green-tested and committed.

**Architecture:** Pure-offline engine (`src/engine/`) feeds thin React cards (`src/app/cards/`). Cards read `model.scoped` + `settings`. Single-file build via vite-plugin-singlefile. No runtime network.

**Tech Stack:** Vite + React 19 + TS + Vitest + Luxon.

## Global Constraints (verbatim, bind every task)
- Offline only: no runtime `fetch`/network, no web workers. Reference data is bundled JSON.
- Engine never reads the clock; `today` is injected. Determinism preserved.
- `tsc --noEmit` must stay clean; full `npm test` green before each commit.
- Settings persisted in localStorage; new fields must default in for old stored blobs (the `{...DEFAULT_SETTINGS, ...stored}` spread in `settings-store.ts` already does this — keep SCHEMA_VERSION=1, additive only).
- Home default = `"DFW"` (Vijay is Dallas-anchored). Layover threshold default = `5` hours.

---

## Design decisions (shared across tasks)

### New engine fields
- `EnrichedFlight.depUtcMs: number | null`, `EnrichedFlight.arrUtcMs: number | null` — absolute instants via `localToUtcMs` (from `duration.ts`, already exported). Dep source string preference mirrors `depHourLocal`: `takeoffActual || gateDepActual || takeoffSched || gateDepSched` with `from.tz`. Arr: `landingActual || gateArrActual || landingSched || gateArrSched` with `to.tz`. Null when no usable string or no tz. Enables: Layovers gap math, Flight Detail real times (#1), sub-day milestone ordering.
- `Settings.home: string | null` — an **airport code** (default `"DFW"`). Compared against route-endpoint tokens via `airportKey(home, groupAirports)` so it matches whether grouping is on (token "Dallas") or off (token "DFW").
- `Settings.layoverMaxHours: number` — default `5`.

### Shared place helpers — `src/app/lib/places.ts` (new)
```ts
import { groups } from '../../engine/reference'
import { airportKey } from '../../engine/normalize'
import type { Settings } from '../../engine'

const membersByName = new Map<string, string[]>()
for (const g of groups) membersByName.set(g.name, g.airports)

/** The settings home rendered in the CURRENT token space (group name when grouping). */
export function homeKey(settings: Settings): string | null {
  if (!settings.home) return null
  return airportKey(settings.home, settings.groupAirports)
}

/** "Dallas" -> "Dallas (DFW/DAL)"; an airport code is returned unchanged. */
export function displayEndpoint(token: string, _settings: Settings): string {
  const members = membersByName.get(token)
  return members ? `${token} (${members.join('/')})` : token
}

export interface RouteParts { left: string; right: string; sep: '↔' | '→'; directed: boolean }

/** Split "A↔B" / "A→B", apply home-first ordering ONLY for undirected (↔) keys
 *  (a directed "A→B" is a real direction — never reversed), then decorate endpoints. */
export function displayRoute(key: string, settings: Settings): RouteParts | null {
  const sep: '↔' | '→' | null = key.includes('↔') ? '↔' : key.includes('→') ? '→' : null
  if (!sep) return null
  const parts = key.split(sep).map((s) => s.trim())
  if (parts.length !== 2) return null
  let [a, b] = parts
  const directed = sep === '→'
  if (!directed) {
    const hk = homeKey(settings)
    if (hk && b === hk && a !== hk) [a, b] = [b, a]   // home leads
  }
  return { left: displayEndpoint(a, settings), right: displayEndpoint(b, settings), sep, directed }
}
```

---

## Task order (dependency-sorted)

### Task 1 — Engine foundation (timestamps + settings fields)
**Files:** Modify `src/engine/types.ts`, `src/engine/enrich.ts`, `src/engine/index.ts`. Test: `src/test/engine/enrich.test.ts`, `src/test/engine/model.test.ts` (or constants).
- Add `depUtcMs`/`arrUtcMs` to `EnrichedFlight`; compute in `enrichFlight` via `localToUtcMs` (import from `./duration`). Add `home`/`layoverMaxHours` to `Settings`; set in `DEFAULT_SETTINGS` (`home: 'DFW'`, `layoverMaxHours: 5`).
- Tests: a flight with `takeoffActual`+`landingActual` → both ms non-null and `arrUtcMs > depUtcMs`; missing times → null. `DEFAULT_SETTINGS.home === 'DFW'` and `.layoverMaxHours === 5`.

### Task 2 — BarList: "Show 10 more / Show all" (#5) + expandable `subRows` (#2 substrate)
**Files:** Modify `src/app/components/charts/BarList.tsx`. Test: `src/test/app/bar-list.test.tsx`.
- `BarRow` gains `subRows?: { label: string; value: number }[]`. A row with subRows shows a small "▸ N …" disclosure that expands indented sub-rows (use the row's `sub` text as the disclosure label, e.g. "(3 states)").
- Replace the single show-more toggle with: a `visibleCount` state (init `max`); **"Show 10 more"** (+10, capped), **"Show all"** (reveal all), **"Show less"** (back to `max`). "Show 10 more"/"Show all" appear when `visibleCount < rows.length`; "Show less" when `visibleCount > max`.
- Tests: with 25 rows, default shows `max`; "Show 10 more" → max+10; "Show all" → 25; "Show less" → max. A row with `subRows` toggles its sub-rows.

### Task 3 — Countries card renders the state split (#2)
**Files:** Modify `src/app/cards/CountriesCard.tsx`. Test: `src/test/app/countries-card.test.tsx`.
- In `buildRows`, for entries with `regions`, set `subRows = c.regions.map(r => ({ label: r.name, value: r.count }))` (keep existing `sub = "(N states)"`).
- Test: a US-touching model expands to show a region name (e.g. "Texas") with a count.

### Task 4 — Shared place helpers + home-first ordering + metro member-codes + home setting (#3, #4)
**Files:** Create `src/app/lib/places.ts`. Modify `src/engine/stats.ts` (`geoExtremes` signature), `src/app/cards/RoutesCard.tsx`, `SuperDomesticCard.tsx`, `IntercontinentalCard.tsx`, `GeoExtremesCard.tsx`, `src/app/components/SettingsPanel.tsx`, `src/reference/airport-groups.json` (rename `"SF Bay"`→`"Bay Area"`). Tests: `src/test/app/places.test.ts` (new), update `routes-card`, `superdomestic-card`, `intercontinental-card`, `geoExtremes-card`, `curated-data` tests as needed.
- `places.ts` as specified above. RoutesCard drops its local `splitRoute`/`routeLabel`, uses `displayRoute`. SuperDomesticCard + IntercontinentalCard: render `displayRoute(r.key, settings)` (left/sep/right) instead of raw `r.key` (they currently show raw keys — gains both home-first AND member codes). Shortest/Longest/Delays show **real flight direction** (raw `fromCode→toCode`) — leave unchanged.
- `geoExtremes(flights, home: { lat: number; lon: number })` — remove module-const HOME; GeoExtremesCard resolves `lookupAirport(settings.home)` → `{lat,lon}`, fallback `{lat:32.8968,lon:-97.0380}` (DFW).
- SettingsPanel: a **Home** `<select>` — options = active groups (label = group name, value = a present member code) + present individual airports not in a group, sorted by visits; selecting updates `settings.home`. Default selection reflects current `home`.
- Rename group "SF Bay" → "Bay Area" in `airport-groups.json` (verify `["SFO","OAK","SJC"]` membership). Update any test asserting "SF Bay".

### Task 5 — Common Layovers card (NEW)
**Files:** Modify `src/engine/stats.ts` (add `commonLayovers`), create `src/app/cards/LayoversCard.tsx`, modify `src/app/cards/registry.ts` (register near airports/routes), `src/app/components/SettingsPanel.tsx` (Max layover hours input). Tests: `src/test/engine/stats.test.ts`, `src/test/app/layovers-card.test.tsx` (new).
- **Definition:** sort `flights` by `depUtcMs` (asc; drop null). For consecutive ordered pair (A,B): a layover at airport `A.toCode` iff `A.resolved && B.resolved && !A.isLocalFlight && !B.isLocalFlight && A.toCode === B.fromCode && A.arrUtcMs != null && B.depUtcMs != null` and `0 < (B.depUtcMs − A.arrUtcMs) ≤ layoverMaxHours*3600000`. Aggregate by display key `airportKey(A.toCode, groupAirports)`; track count + mean gap minutes.
- `commonLayovers(flights, settings): { key: string; airportCode: string; count: number; avgGapMin: number }[]` sorted desc by count.
- LayoversCard: BarList rows `{ label: displayEndpoint(key, settings), value: count, sub: "~Xh Ym typical" }`. Eyebrow "Where you connect". Accent a fresh hue (e.g. tangerine `#ff7a14` is taken by super-domestic; use teal `#12c08a`? taken by airports — pick violet-pink or a new `#ff2fa8`-adjacent; choose `#7c5cff` or reuse the sky `#1aa9ff`). Pick an unused-feeling accent; cosmetic.
- SettingsPanel: number input "Max layover hours" bound to `settings.layoverMaxHours`.
- Tests: 3 synthetic flights (A→DFW, DFW→B within 3h, plus an unrelated) → one layover at DFW count 1; gap > threshold → none; A.to≠B.from → none.

### Task 6 — Generic branding: "flight logs CSV" (#10)
**Files:** Modify `src/app/components/Dropzone.tsx` (+ grep for other user-facing "Flighty" in `src/app/`). Test: `src/test/app/dropzone.test.tsx`.
- Heading stays "✈️ Flight Visualizer". Sub-copy → "Drop your flight logs CSV here…". Validation error → `"X" doesn't look like a flight logs CSV — missing columns: …`. Engine `REQUIRED_COLUMNS` unchanged.
- Update dropzone test regexes to `/drop your flight logs csv/i` and `/doesn't look like a flight logs csv/i`.

### Task 7 — Click-through to flight lists + Flight Detail (#1) [BIG]
**Files:** Create `src/app/components/FlightsOverlay.tsx`, `src/app/components/FlightDetail.tsx`, an overlay store/context. Modify `BarList.tsx` (optional `onRowClick`), `App.tsx` (mount overlay root), and wire cards (Countries→country, Airports→airport, Airlines, Routes, Layovers, Shortest/Longest/Delays→single Flight Detail).
- Generic overlay: title + flight array (or predicate over `model.scoped`), capped/virtualized list, Esc/back, stacked overlays. Row click → Flight Detail (uses depUtcMs/arrUtcMs for real times). Scope as its own mini-plan when reached.

### Task 8 — Stable masonry packing (#6)
**Files:** Modify `src/app/components/CardGrid.tsx` (+ maybe a `useMasonry` hook). 
- Replace CSS `column-count` with height-aware greedy column assignment (measure via ResizeObserver, place each card in the shortest column). Recompute on viewport resize / card-count change, but **not** on a card's internal expand (expansion grows its existing column — no reshuffle). Map card stays full-width.

---

## Finish
Full `npm test` + `tsc --noEmit` + `npm run build` (watch the ~8MB budget). Final whole-branch review. Update `docs/BACKLOG.md` (check off shipped items) + memory. Offer finishing-a-development-branch options.
