# Flight Visualizer — Phase 0 Implementation Plan (Reference Pipeline + Engine)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the data foundation — the bundled reference files and the pure, fully-tested enrichment/aggregation engine — that every UI card in later phases consumes. No React UI in this plan; the deliverable is a tested TypeScript library + a build-time preprocess pipeline.

**Architecture:** A dev-time **preprocess** step downloads OurAirports + OpenFlights data and emits trimmed JSON reference files (plus hand-authored curated files). A pure **engine** (no React, no DOM, no network) parses a Flighty CSV, enriches each row (distance, timezone-aware duration, country/region/continent, airline name, flags), applies per-flight overrides, normalizes route/airport identity by settings, and aggregates per-card stats. Everything is validated against a hand-computed 12-row golden fixture and smoke-tested against the real export.

**Tech Stack:** Vite + React + **TypeScript**, Vitest (tests), PapaParse (`worker:false`) for CSV, Luxon (timezone-aware datetime math), tz-lookup (coordinate→IANA timezone at preprocess time). Node ≥ 20 for preprocess scripts (`tsx` runner).

## Global Constraints

_(Copied verbatim from the spec; every task implicitly includes these.)_

- **Local-only, no runtime network, no `fetch` at runtime.** Reference data is `import`ed (baked into the bundle). Network is allowed only in dev-time preprocess scripts.
- **No web workers** anywhere (PapaParse must use `worker: false`). Engine runs synchronously.
- **Never emit a negative duration** (clamp + flag).
- **Bundle budget:** the eventual single `index.html` must stay **< 4 MB**; reference JSON is trimmed accordingly. Phase 0 adds a size log for `src/reference/*.json`.
- **Timestamps are local wall-clock with no offset**, in two formats: `YYYY-MM-DDTHH:mm` and `YYYY-MM-DDTHH:mm:ss`.
- **Airport resolution order:** IATA → FAA `local_code` → ICAO `ident` (ident tried as-is and with a leading `K`/`C` stripped).
- **`Flight Flighty ID` is unreliable** (blank on ~45/1800 rows) — never use it as a key or sole sort tiebreak.
- **Today's date** for the flown/upcoming split is injected, never read from the system clock inside the engine (keeps the engine pure/testable).

---

## File Structure

```
flight_visualizer/
  package.json                      # deps + scripts (preprocess, test, build)
  tsconfig.json
  vite.config.ts                    # vitest config lives here
  scripts/preprocess/
    lib/fetch-csv.ts                # download + parse a CSV to rows (dev-time)
    build-airports.ts               # OurAirports airports.csv -> src/reference/airports.json
    build-airlines.ts               # OpenFlights airlines.dat -> src/reference/airlines.json
    build-regions.ts                # OurAirports regions.csv + countries.csv -> src/reference/regions.json
    size-check.ts                   # assert src/reference/*.json under budget
  src/reference/
    airports.json                   # GENERATED
    airlines.json                   # GENERATED
    regions.json                    # GENERATED
    airport-groups.json             # CURATED (metros)
    aircraft-classes.json           # CURATED (type-name -> class rules)
    airline-overrides.json          # CURATED (ICAO -> name, for OpenFlights misses)
    flight-overrides.json           # CURATED (signature -> patch; seeded with RPJ)
  src/engine/
    types.ts                        # all shared types
    constants.ts                    # duration constants, Earth radius, etc.
    parse.ts                        # CSV text -> RawFlight[]
    reference.ts                    # typed loaders + lookup indexes over reference JSON
    resolve.ts                      # code -> Airport | null ; code -> airlineName
    distance.ts                     # haversine
    duration.ts                     # timezone-aware duration fallback chain
    overrides.ts                    # signature key + apply per-flight overrides
    enrich.ts                       # RawFlight -> EnrichedFlight
    normalize.ts                    # group x unique route/airport identity
    classify.ts                     # region tiers + super-domestic/intercontinental
    aggregate.ts                    # byAirport/byRoute/byAirline/distanceBuckets/byYear/milestones
    filter.ts                       # scope + settings filtering, flown/upcoming
    index.ts                        # public API: buildModel(csvText, settings, today)
  src/test/
    fixtures/golden.csv             # 12-row hand-computed fixture
    fixtures/overrides.test.json    # override fixture for the overrides test
    engine/*.test.ts                # one test file per engine module
```

> **Note on the existing seed:** a `flight-overrides.json` already exists at `flight_visualizer/reference/flight-overrides.json` (from spec work). Task 5 moves it to `src/reference/flight-overrides.json` (its bundled home) and deletes the old `reference/` copy.

---

## Task 1: Project scaffold + types + constants

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`
- Create: `src/engine/types.ts`, `src/engine/constants.ts`
- Test: `src/test/engine/constants.test.ts`

**Interfaces:**
- Produces: the entire shared type vocabulary used by every later task (see code below), and `DEFAULT_DURATION_CONSTANTS`, `EARTH_RADIUS_MI`.

> **Toolchain note (read first):** plain `npm` resolves to Homebrew **npm 11.x** (Node 26). Do **not** run `npm create vite` — it interactively prompts on a non-empty directory and will hang a non-interactive subagent. Hand-write the three config files below instead. Preserve the existing `docs/`, `reference/`, `.claude/`, `.git/`, `.gitignore`.

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "flight-visualizer",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "pp:airports": "tsx scripts/preprocess/build-airports.ts",
    "pp:airlines": "tsx scripts/preprocess/build-airlines.ts",
    "pp:regions": "tsx scripts/preprocess/build-regions.ts",
    "pp:size": "tsx scripts/preprocess/size-check.ts",
    "preprocess": "npm run pp:airports && npm run pp:airlines && npm run pp:regions && npm run pp:size"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "papaparse": "^5.4.1",
    "luxon": "^3.5.0"
  },
  "devDependencies": {
    "@types/luxon": "^3.4.2",
    "@types/node": "^22.10.0",
    "@types/papaparse": "^5.3.15",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.4",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "tz-lookup": "^6.1.25",
    "vite": "^6.0.0",
    "vite-plugin-singlefile": "^2.1.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json`** (single config; `resolveJsonModule` lets the engine `import` reference JSON as ES modules)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "types": ["node", "vitest/globals"]
  },
  "include": ["src", "scripts"]
}
```

- [ ] **Step 3: Write `vite.config.ts`**

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './', // relative asset paths so the built file works under file://
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/test/**/*.test.ts', 'src/test/**/*.test.tsx'],
  },
})
```

- [ ] **Step 3b: Install dependencies**

Run: `npm --prefix /Users/vijayram/Cursor/flight_visualizer install`
Expected: `node_modules/` + `package-lock.json` created; no errors. (`npm --version` should report 11.x — the modern Homebrew npm.)

- [ ] **Step 4: Write `src/engine/types.ts`**

```ts
export type Continent = 'NA' | 'SA' | 'EU' | 'AF' | 'AS' | 'OC' | 'AN'
export type AircraftClass = 'wide' | 'narrow' | 'regional' | 'prop' | 'unclassified'
export type DurationSource = 'actual' | 'scheduled' | 'gate' | 'estimate' | 'localDefault' | 'override'

export interface Airport {
  iata: string | null
  localCode: string | null
  ident: string
  name: string
  municipality: string
  lat: number
  lon: number
  country: string      // ISO country code, e.g. "US"
  region: string       // ISO region code, e.g. "US-TX"
  continent: Continent
  tz: string           // IANA, e.g. "America/Chicago"
}

/** One raw CSV row, all strings, blanks as "". Keys match Flighty headers. */
export interface RawFlight {
  rawIndex: number     // 0-based position in the file (stable tiebreak)
  date: string
  airlineCode: string
  flightNumber: string
  fromCode: string
  toCode: string
  canceled: boolean
  divertedToCode: string
  gateDepSched: string
  gateDepActual: string
  takeoffSched: string
  takeoffActual: string
  landingSched: string
  landingActual: string
  gateArrSched: string
  gateArrActual: string
  aircraftType: string
  tail: string
  pnr: string
  seat: string
  cabin: string
  reason: string
  notes: string
  flightyId: string    // may be ""
}

export interface DurationConstants {
  cruiseMph: number
  taxiMin: number
  climbDescentMin: number
  gateTaxiMin: number
  localFlightDefaultMin: number
  localFlightMinMin: number
}

export interface EnrichedFlight {
  id: string                 // stable: flightyId || `row:${rawIndex}`
  rawIndex: number
  date: string               // YYYY-MM-DD (departure date)
  year: number
  airlineCode: string
  airlineName: string        // resolved or raw code or "Unknown airline"
  flightNumber: string
  fromCode: string
  toCode: string             // EFFECTIVE destination (diverted-to if diverted)
  intendedToCode: string | null  // original scheduled To when diverted, else null
  from: Airport | null
  to: Airport | null         // effective destination airport
  resolved: boolean          // both endpoints resolved
  distanceMi: number | null
  durationMin: number | null
  durationSource: DurationSource | null
  delayMin: number | null
  depHourLocal: number | null  // 0-23 from raw local takeoff/gate-dep, no tz shift
  arrHourLocal: number | null
  canceled: boolean
  diverted: boolean
  flown: boolean
  isLocalFlight: boolean     // From == To after resolution (legitimate local flight)
  excluded: boolean          // dropped by an override
  aircraftType: string
  aircraftClass: AircraftClass
  tail: string
  seat: string
  cabin: string
  pnr: string
  notes: string
}

export interface Settings {
  groupAirports: boolean
  explicitlyUnique: boolean
  includeCanceled: boolean
  excludeBeforeDate: string | null  // "YYYY-MM-DD" or null
  duration: DurationConstants
}
```

- [ ] **Step 5: Write `src/engine/constants.ts`**

```ts
import type { DurationConstants } from './types'

export const EARTH_RADIUS_MI = 3958.7613

export const DEFAULT_DURATION_CONSTANTS: DurationConstants = {
  cruiseMph: 500,
  taxiMin: 30,
  climbDescentMin: 15,
  gateTaxiMin: 10,
  localFlightDefaultMin: 20,
  localFlightMinMin: 5,
}
```

- [ ] **Step 6: Write the test `src/test/engine/constants.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { DEFAULT_DURATION_CONSTANTS, EARTH_RADIUS_MI } from '../../engine/constants'

describe('constants', () => {
  it('uses 500mph cruise + 30min taxi + 15 climb/descent', () => {
    expect(DEFAULT_DURATION_CONSTANTS.cruiseMph).toBe(500)
    expect(DEFAULT_DURATION_CONSTANTS.taxiMin).toBe(30)
    expect(DEFAULT_DURATION_CONSTANTS.climbDescentMin).toBe(15)
  })
  it('local flight default ~20min', () => {
    expect(DEFAULT_DURATION_CONSTANTS.localFlightDefaultMin).toBe(20)
  })
  it('Earth radius in miles', () => {
    expect(EARTH_RADIUS_MI).toBeCloseTo(3958.76, 1)
  })
})
```

- [ ] **Step 7: Run the test**

Run: `npm --prefix /Users/vijayram/Cursor/flight_visualizer test`
Expected: PASS (3 tests).

- [ ] **Step 8: Commit**

```bash
git -C /Users/vijayram/Cursor/flight_visualizer add -A
git -C /Users/vijayram/Cursor/flight_visualizer commit -m "chore: scaffold Vite+TS, engine types and constants"
```

---

## Task 2: Preprocess — airports.json from OurAirports

**Files:**
- Create: `scripts/preprocess/lib/fetch-csv.ts`, `scripts/preprocess/build-airports.ts`
- Create (generated): `src/reference/airports.json`
- Test: `src/test/engine/airports-data.test.ts`

**Interfaces:**
- Produces: `src/reference/airports.json` = `Record<string, AirportRecord>` keyed by a normalized lookup token, plus a `meta` block. Shape per airport: `{ iata, localCode, ident, name, municipality, lat, lon, country, region, continent, tz }` (matches `Airport`). The file is an **array** `AirportRecord[]`; the engine builds lookup indexes (Task 7), so the file stays a flat list.

- [ ] **Step 1: Write `scripts/preprocess/lib/fetch-csv.ts`**

```ts
import Papa from 'papaparse'

export async function fetchCsv(url: string): Promise<Record<string, string>[]> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Fetch failed ${res.status}: ${url}`)
  const text = await res.text()
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    worker: false,
  })
  return parsed.data
}
```

- [ ] **Step 2: Write `scripts/preprocess/build-airports.ts`**

```ts
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import tzlookup from 'tz-lookup'
import { fetchCsv } from './lib/fetch-csv'

const OURAIRPORTS = 'https://davidmegginson.github.io/ourairports-data/airports.csv'
const KEEP_TYPES = new Set(['large_airport', 'medium_airport', 'small_airport'])

const here = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(here, '../../src/reference/airports.json')

function num(s: string): number | null {
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

async function main() {
  const rows = await fetchCsv(OURAIRPORTS)
  const out: unknown[] = []
  let skipped = 0
  for (const r of rows) {
    const iata = (r.iata_code || '').trim()
    const localCode = (r.local_code || '').trim()
    const type = (r.type || '').trim()
    // Keep: anything with an IATA code, OR a real airport type carrying an FAA local_code.
    if (!iata && !(KEEP_TYPES.has(type) && localCode)) { skipped++; continue }
    const lat = num(r.latitude_deg)
    const lon = num(r.longitude_deg)
    if (lat === null || lon === null) { skipped++; continue }
    let tz = ''
    try { tz = tzlookup(lat, lon) } catch { tz = '' }
    out.push({
      iata: iata || null,
      localCode: localCode || null,
      ident: (r.ident || '').trim(),
      name: (r.name || '').trim(),
      municipality: (r.municipality || '').trim(),
      lat, lon,
      country: (r.iso_country || '').trim(),
      region: (r.iso_region || '').trim(),
      continent: (r.continent || '').trim(),
      tz,
    })
  }
  writeFileSync(OUT, JSON.stringify(out))
  console.log(`airports.json: ${out.length} kept, ${skipped} skipped`)
}
main().catch((e) => { console.error(e); process.exit(1) })
```

- [ ] **Step 3: Run the preprocess for airports**

Run: `npm --prefix /Users/vijayram/Cursor/flight_visualizer run pp:airports`
Expected: prints `airports.json: <N> kept, <M> skipped` with N in the ~9k–25k range; `src/reference/airports.json` written.

- [ ] **Step 4: Write the failing data test `src/test/engine/airports-data.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import airports from '../../reference/airports.json'

type Rec = { iata: string | null; localCode: string | null; ident: string; lat: number; lon: number; country: string; region: string; continent: string; tz: string }

const byIata = (code: string) => (airports as Rec[]).find((a) => a.iata === code)
const byLocal = (code: string) => (airports as Rec[]).find((a) => a.localCode === code)

describe('airports.json', () => {
  it('resolves DFW with coords, region, continent, tz', () => {
    const dfw = byIata('DFW')!
    expect(dfw).toBeTruthy()
    expect(dfw.lat).toBeCloseTo(32.897, 1)
    expect(dfw.lon).toBeCloseTo(-97.038, 1)
    expect(dfw.region).toBe('US-TX')
    expect(dfw.continent).toBe('NA')
    expect(dfw.tz).toBe('America/Chicago')
  })
  it('includes HNL on continent OC (Hawaii)', () => {
    expect(byIata('HNL')!.continent).toBe('OC')
  })
  it('includes RPJ via FAA local_code (Rochelle, IL — blank IATA)', () => {
    const rpj = byLocal('RPJ')!
    expect(rpj).toBeTruthy()
    expect(rpj.iata).toBeNull()
    expect(rpj.region).toBe('US-IL')
  })
  it('includes MEX with a Mexico City region code', () => {
    expect(byIata('MEX')!.region).toMatch(/^MX-/)
  })
})
```

- [ ] **Step 5: Run the test**

Run: `npm --prefix /Users/vijayram/Cursor/flight_visualizer test -- airports-data`
Expected: PASS. If RPJ fails, confirm OurAirports lists Rochelle as `small_airport` with `local_code=RPJ`; widen `KEEP_TYPES` only if needed.

- [ ] **Step 6: Commit**

```bash
git -C /Users/vijayram/Cursor/flight_visualizer add -A
git -C /Users/vijayram/Cursor/flight_visualizer commit -m "feat: preprocess airports.json (IATA + FAA codes, tz via tz-lookup)"
```

---

## Task 3: Preprocess — airlines.json from OpenFlights + override map

**Files:**
- Create: `scripts/preprocess/build-airlines.ts`
- Create (generated): `src/reference/airlines.json`
- Create (curated): `src/reference/airline-overrides.json`
- Test: `src/test/engine/airlines-data.test.ts`

**Interfaces:**
- Produces: `src/reference/airlines.json` = `Record<string,string>` mapping ICAO → airline name. `airline-overrides.json` = `Record<string,string>` merged over it at engine load (Task 6).

- [ ] **Step 1: Write `src/reference/airline-overrides.json` (verified entries only — do not guess names)**

```json
{
  "JSX": "JSX",
  "NOZ": "Norse Atlantic Airways",
  "BEL": "Brussels Airlines",
  "COA": "Continental Airlines",
  "AWE": "US Airways",
  "VRD": "Virgin America"
}
```

- [ ] **Step 2: Write `scripts/preprocess/build-airlines.ts`**

```ts
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import Papa from 'papaparse'

const URL = 'https://raw.githubusercontent.com/jpatokal/openflights/master/data/airlines.dat'
const here = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(here, '../../src/reference/airlines.json')

// airlines.dat columns: id, name, alias, iata, icao, callsign, country, active
async function main() {
  const res = await fetch(URL)
  const text = await res.text()
  const rows = Papa.parse<string[]>(text, { worker: false }).data
  type Cand = { id: number; name: string; active: boolean }
  const byIcao = new Map<string, Cand[]>()
  for (const row of rows) {
    if (!row || row.length < 8) continue
    const id = Number(row[0])
    const name = (row[1] || '').replace(/^"|"$/g, '').trim()
    const icao = (row[4] || '').replace(/^"|"$/g, '').trim()
    const active = (row[7] || '').replace(/^"|"$/g, '').trim() === 'Y'
    if (!icao || icao === '\\N' || icao.length !== 3) continue
    if (!name || name === '\\N' || /^unknown$/i.test(name)) continue
    const list = byIcao.get(icao) ?? []
    list.push({ id, name, active })
    byIcao.set(icao, list)
  }
  const out: Record<string, string> = {}
  let collisions = 0
  for (const [icao, cands] of byIcao) {
    if (cands.length > 1) collisions++
    // Prefer active=Y, then a name without "Domestic", then lowest id.
    cands.sort((a, b) =>
      Number(b.active) - Number(a.active) ||
      Number(/domestic/i.test(a.name)) - Number(/domestic/i.test(b.name)) ||
      a.id - b.id
    )
    out[icao] = cands[0].name
  }
  writeFileSync(OUT, JSON.stringify(out))
  console.log(`airlines.json: ${Object.keys(out).length} ICAO codes, ${collisions} collisions resolved`)
}
main().catch((e) => { console.error(e); process.exit(1) })
```

- [ ] **Step 3: Run the preprocess for airlines**

Run: `npm --prefix /Users/vijayram/Cursor/flight_visualizer run pp:airlines`
Expected: prints count + collisions; `airlines.json` written.

- [ ] **Step 4: Write the failing test `src/test/engine/airlines-data.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import airlines from '../../reference/airlines.json'
import overrides from '../../reference/airline-overrides.json'

const map = { ...(airlines as Record<string, string>), ...(overrides as Record<string, string>) }

describe('airlines.json (+ overrides)', () => {
  it('AAL resolves to American Airlines', () => {
    expect(map['AAL']).toMatch(/American/i)
  })
  it('JAL resolves to a single canonical Japan Airlines (collision dedup)', () => {
    expect(map['JAL']).toMatch(/Japan Airlines/i)
  })
  it('override fills OpenFlights misses', () => {
    expect(map['NOZ']).toBe('Norse Atlantic Airways')
    expect(map['BEL']).toBe('Brussels Airlines')
  })
})
```

- [ ] **Step 5: Run the test**

Run: `npm --prefix /Users/vijayram/Cursor/flight_visualizer test -- airlines-data`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git -C /Users/vijayram/Cursor/flight_visualizer add -A
git -C /Users/vijayram/Cursor/flight_visualizer commit -m "feat: preprocess airlines.json with collision dedup + override map"
```

---

## Task 4: Preprocess — regions.json (region + country display names)

**Files:**
- Create: `scripts/preprocess/build-regions.ts`
- Create (generated): `src/reference/regions.json`
- Test: `src/test/engine/regions-data.test.ts`

**Interfaces:**
- Produces: `src/reference/regions.json` = `{ regions: Record<string,string>, countries: Record<string,string> }`. `regions` maps ISO region code → human name (with deprecated `MX-DIF` aliased to the `MX-CMX` name). `countries` maps ISO country code → country name.

- [ ] **Step 1: Write `scripts/preprocess/build-regions.ts`**

```ts
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { fetchCsv } from './lib/fetch-csv'

const REGIONS = 'https://davidmegginson.github.io/ourairports-data/regions.csv'
const COUNTRIES = 'https://davidmegginson.github.io/ourairports-data/countries.csv'
const here = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(here, '../../src/reference/regions.json')

async function main() {
  const regionRows = await fetchCsv(REGIONS)   // columns: id, code, local_code, name, continent, iso_country, ...
  const countryRows = await fetchCsv(COUNTRIES) // columns: id, code, name, continent, ...
  const regions: Record<string, string> = {}
  for (const r of regionRows) {
    const code = (r.code || '').trim()
    const name = (r.name || '').trim()
    if (code && name) regions[code] = name
  }
  // Mexico City: MEX airports may carry deprecated MX-DIF; alias to the CDMX name.
  if (regions['MX-CMX']) regions['MX-DIF'] = regions['MX-CMX']
  const countries: Record<string, string> = {}
  for (const c of countryRows) {
    const code = (c.code || '').trim()
    const name = (c.name || '').trim()
    if (code && name) countries[code] = name
  }
  writeFileSync(OUT, JSON.stringify({ regions, countries }))
  console.log(`regions.json: ${Object.keys(regions).length} regions, ${Object.keys(countries).length} countries`)
}
main().catch((e) => { console.error(e); process.exit(1) })
```

- [ ] **Step 2: Run the preprocess for regions**

Run: `npm --prefix /Users/vijayram/Cursor/flight_visualizer run pp:regions`
Expected: prints region + country counts; `regions.json` written.

- [ ] **Step 3: Write the failing test `src/test/engine/regions-data.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import regions from '../../reference/regions.json'

const { regions: r, countries: c } = regions as { regions: Record<string, string>; countries: Record<string, string> }

describe('regions.json', () => {
  it('names US states', () => {
    expect(r['US-TX']).toMatch(/Texas/i)
  })
  it('aliases deprecated MX-DIF to the Mexico City name', () => {
    expect(r['MX-DIF']).toBeTruthy()
    expect(r['MX-DIF']).toBe(r['MX-CMX'])
  })
  it('names India states', () => {
    expect(r['IN-TN']).toMatch(/Tamil Nadu/i)
  })
  it('names countries', () => {
    expect(c['US']).toMatch(/United States/i)
    expect(c['MX']).toMatch(/Mexico/i)
  })
})
```

- [ ] **Step 4: Run the test**

Run: `npm --prefix /Users/vijayram/Cursor/flight_visualizer test -- regions-data`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git -C /Users/vijayram/Cursor/flight_visualizer add -A
git -C /Users/vijayram/Cursor/flight_visualizer commit -m "feat: preprocess regions.json (region + country display names, MX-DIF alias)"
```

---

## Task 5: Curated reference files (groups, aircraft classes, overrides) + size check

**Files:**
- Create: `src/reference/airport-groups.json`, `src/reference/aircraft-classes.json`
- Move: `reference/flight-overrides.json` → `src/reference/flight-overrides.json` (delete old `reference/`)
- Create: `scripts/preprocess/size-check.ts`
- Test: `src/test/engine/curated-data.test.ts`

**Interfaces:**
- Produces: `airport-groups.json` = `{ name: string; airports: string[] }[]`. `aircraft-classes.json` = `{ pattern: string; class: AircraftClass }[]` (first match wins; case-insensitive substring on Aircraft Type Name). `flight-overrides.json` = `{ overrides: { signature: string; durationMinOverride?: number|null; distanceMiOverride?: number|null; from?: string; to?: string; exclude?: boolean; note?: string }[] }`.

- [ ] **Step 1: Write `src/reference/airport-groups.json`**

```json
[
  { "name": "Dallas", "airports": ["DFW", "DAL"] },
  { "name": "Houston", "airports": ["IAH", "HOU", "EFD"] },
  { "name": "New York", "airports": ["JFK", "LGA", "EWR", "HPN", "ISP"] },
  { "name": "Washington DC", "airports": ["IAD", "DCA", "BWI"] },
  { "name": "Chicago", "airports": ["ORD", "MDW"] },
  { "name": "SF Bay", "airports": ["SFO", "OAK", "SJC"] },
  { "name": "Los Angeles", "airports": ["LAX", "BUR", "SNA", "ONT", "LGB"] },
  { "name": "South Florida", "airports": ["MIA", "FLL", "PBI"] },
  { "name": "London", "airports": ["LHR", "LGW", "STN", "LTN", "LCY", "SEN"] },
  { "name": "Boston", "airports": ["BOS", "PVD", "MHT"] },
  { "name": "Rio Grande Valley", "airports": ["HRL", "BRO", "MFE"] },
  { "name": "Tokyo", "airports": ["HND", "NRT"] },
  { "name": "Paris", "airports": ["CDG", "ORY", "BVA"] },
  { "name": "Seoul", "airports": ["ICN", "GMP"] },
  { "name": "Milan", "airports": ["MXP", "LIN", "BGY"] },
  { "name": "Sao Paulo", "airports": ["GRU", "CGH", "VCP"] },
  { "name": "Moscow", "airports": ["SVO", "DME", "VKO"] },
  { "name": "Rome", "airports": ["FCO", "CIA"] },
  { "name": "Bangkok", "airports": ["BKK", "DMK"] },
  { "name": "Istanbul", "airports": ["IST", "SAW"] },
  { "name": "Buenos Aires", "airports": ["EZE", "AEP"] },
  { "name": "Stockholm", "airports": ["ARN", "BMA", "NYO"] },
  { "name": "Osaka", "airports": ["KIX", "ITM"] },
  { "name": "Shanghai", "airports": ["PVG", "SHA"] },
  { "name": "Berlin", "airports": ["BER"] },
  { "name": "Toronto", "airports": ["YYZ", "YTZ"] },
  { "name": "Montreal", "airports": ["YUL", "YMX"] }
]
```

- [ ] **Step 2: Write `src/reference/aircraft-classes.json`** (first match wins; `Helio` mapped to prop per the known Flighty mislabel)

```json
[
  { "pattern": "747", "class": "wide" },
  { "pattern": "777", "class": "wide" },
  { "pattern": "787", "class": "wide" },
  { "pattern": "767", "class": "wide" },
  { "pattern": "A330", "class": "wide" },
  { "pattern": "A340", "class": "wide" },
  { "pattern": "A350", "class": "wide" },
  { "pattern": "A380", "class": "wide" },
  { "pattern": "A300", "class": "wide" },
  { "pattern": "A310", "class": "wide" },
  { "pattern": "MD-11", "class": "wide" },
  { "pattern": "DC-10", "class": "wide" },
  { "pattern": "L-1011", "class": "wide" },
  { "pattern": "CRJ", "class": "regional" },
  { "pattern": "Embraer", "class": "regional" },
  { "pattern": "ERJ", "class": "regional" },
  { "pattern": "E-Jet", "class": "regional" },
  { "pattern": "E170", "class": "regional" },
  { "pattern": "E175", "class": "regional" },
  { "pattern": "E190", "class": "regional" },
  { "pattern": "E195", "class": "regional" },
  { "pattern": "Dash 8", "class": "regional" },
  { "pattern": "Q400", "class": "regional" },
  { "pattern": "ATR", "class": "regional" },
  { "pattern": "737", "class": "narrow" },
  { "pattern": "757", "class": "narrow" },
  { "pattern": "727", "class": "narrow" },
  { "pattern": "717", "class": "narrow" },
  { "pattern": "A320", "class": "narrow" },
  { "pattern": "A319", "class": "narrow" },
  { "pattern": "A321", "class": "narrow" },
  { "pattern": "A318", "class": "narrow" },
  { "pattern": "MD-80", "class": "narrow" },
  { "pattern": "MD-90", "class": "narrow" },
  { "pattern": "MD-88", "class": "narrow" },
  { "pattern": "DC-9", "class": "narrow" },
  { "pattern": "Twin Otter", "class": "prop" },
  { "pattern": "DHC-6", "class": "prop" },
  { "pattern": "Caravan", "class": "prop" },
  { "pattern": "Cessna", "class": "prop" },
  { "pattern": "King Air", "class": "prop" },
  { "pattern": "Pilatus", "class": "prop" },
  { "pattern": "Helio", "class": "prop" }
]
```

- [ ] **Step 3: Move the seeded overrides file into the bundle path**

Run:
```bash
mkdir -p /Users/vijayram/Cursor/flight_visualizer/src/reference
git -C /Users/vijayram/Cursor/flight_visualizer mv reference/flight-overrides.json src/reference/flight-overrides.json
rmdir /Users/vijayram/Cursor/flight_visualizer/reference
```
Expected: file now at `src/reference/flight-overrides.json`; old `reference/` dir gone. (If `git mv` fails because the file was never committed in this layout, use `mv` then `git add -A`.)

- [ ] **Step 4: Write `scripts/preprocess/size-check.ts`**

```ts
import { statSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const DIR = resolve(here, '../../src/reference')
const BUDGET_BYTES = 4 * 1024 * 1024

let total = 0
for (const f of readdirSync(DIR)) {
  if (!f.endsWith('.json')) continue
  const bytes = statSync(join(DIR, f)).size
  total += bytes
  console.log(`${f}: ${(bytes / 1024).toFixed(0)} KB`)
}
console.log(`TOTAL reference JSON: ${(total / 1024 / 1024).toFixed(2)} MB (budget ${BUDGET_BYTES / 1024 / 1024} MB)`)
if (total > BUDGET_BYTES) {
  console.error('Reference JSON exceeds budget — tighten the airports.json filter.')
  process.exit(1)
}
```

- [ ] **Step 5: Run the size check**

Run: `npm --prefix /Users/vijayram/Cursor/flight_visualizer run pp:size`
Expected: per-file sizes + total under 4 MB (exit 0). If it fails, narrow `KEEP_TYPES` in Task 2 to `large_airport`+`medium_airport` plus small_airports only in `iso_country == 'US'`, and re-run Task 2.

- [ ] **Step 6: Write the failing test `src/test/engine/curated-data.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import groups from '../../reference/airport-groups.json'
import classes from '../../reference/aircraft-classes.json'
import overrides from '../../reference/flight-overrides.json'

describe('curated reference files', () => {
  it('groups Dallas as DFW+DAL', () => {
    const dallas = (groups as { name: string; airports: string[] }[]).find((g) => g.name === 'Dallas')!
    expect(dallas.airports).toEqual(expect.arrayContaining(['DFW', 'DAL']))
  })
  it('classifies the Twin Otter / Helio as prop', () => {
    const list = classes as { pattern: string; class: string }[]
    const match = (name: string) => list.find((r) => name.toLowerCase().includes(r.pattern.toLowerCase()))?.class
    expect(match('DHC-6 Twin Otter')).toBe('prop')
    expect(match('Helio H-500 Twin Courier')).toBe('prop')
    expect(match('Boeing 777')).toBe('wide')
    expect(match('Boeing 737-800')).toBe('narrow')
    expect(match('Bombardier CRJ700')).toBe('regional')
  })
  it('seeds the RPJ skydiving override', () => {
    const o = (overrides as { overrides: { signature: string }[] }).overrides
    expect(o.some((x) => x.signature === '2013-08-18|RPJ|RPJ|2013-08-18T12:00')).toBe(true)
  })
})
```

- [ ] **Step 7: Run the test**

Run: `npm --prefix /Users/vijayram/Cursor/flight_visualizer test -- curated-data`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git -C /Users/vijayram/Cursor/flight_visualizer add -A
git -C /Users/vijayram/Cursor/flight_visualizer commit -m "feat: curated reference files (groups, aircraft classes) + size check; relocate overrides"
```

---

## Task 6: Reference loaders + lookup indexes

**Files:**
- Create: `src/engine/reference.ts`
- Test: `src/test/engine/reference.test.ts`

**Interfaces:**
- Consumes: the JSON files from Tasks 2–5.
- Produces:
  - `airportIndex: Map<string, Airport>` (keyed by IATA, local_code, ident, and de-K'd ident — all uppercased).
  - `lookupAirport(code: string): Airport | null`
  - `lookupAirline(icao: string): string | null` (merged airlines + overrides).
  - `regionName(code: string): string`, `countryName(code: string): string`.
  - `groups: { name: string; airports: string[] }[]`, `airportToGroup: Map<string,string>`.
  - `classifyAircraft(typeName: string): AircraftClass`.

- [ ] **Step 1: Write `src/test/engine/reference.test.ts` (failing)**

```ts
import { describe, it, expect } from 'vitest'
import { lookupAirport, lookupAirline, classifyAircraft, airportToGroup, regionName } from '../../engine/reference'

describe('reference lookups', () => {
  it('finds DFW by IATA', () => {
    expect(lookupAirport('DFW')?.region).toBe('US-TX')
  })
  it('finds RPJ by FAA local_code', () => {
    expect(lookupAirport('RPJ')?.region).toBe('US-IL')
  })
  it('returns null for an unknown code', () => {
    expect(lookupAirport('ZZZ')).toBeNull()
  })
  it('resolves airline names with override fallthrough', () => {
    expect(lookupAirline('AAL')).toMatch(/American/i)
    expect(lookupAirline('NOZ')).toBe('Norse Atlantic Airways')
    expect(lookupAirline('ZZZ')).toBeNull()
  })
  it('maps DFW and DAL to the Dallas group', () => {
    expect(airportToGroup.get('DFW')).toBe('Dallas')
    expect(airportToGroup.get('DAL')).toBe('Dallas')
  })
  it('classifies aircraft and names regions', () => {
    expect(classifyAircraft('Boeing 777')).toBe('wide')
    expect(classifyAircraft('')).toBe('unclassified')
    expect(regionName('US-TX')).toMatch(/Texas/i)
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm --prefix /Users/vijayram/Cursor/flight_visualizer test -- reference`
Expected: FAIL (module not found).

- [ ] **Step 3: Write `src/engine/reference.ts`**

```ts
import type { Airport, AircraftClass, Continent } from './types'
import airportsRaw from '../reference/airports.json'
import airlinesRaw from '../reference/airlines.json'
import airlineOverrides from '../reference/airline-overrides.json'
import regionsRaw from '../reference/regions.json'
import groupsRaw from '../reference/airport-groups.json'
import classesRaw from '../reference/aircraft-classes.json'

const records = airportsRaw as Airport[]

export const airportIndex = new Map<string, Airport>()
for (const a of records) {
  const keys = [a.iata, a.localCode, a.ident, a.ident.replace(/^[KC]/, '')]
  for (const k of keys) {
    if (!k) continue
    const key = k.toUpperCase()
    if (!airportIndex.has(key)) airportIndex.set(key, a) // IATA wins (inserted first via order below)
  }
}
// Ensure IATA takes precedence: re-insert IATA keys last-wins by overwriting.
for (const a of records) if (a.iata) airportIndex.set(a.iata.toUpperCase(), a)

export function lookupAirport(code: string): Airport | null {
  if (!code) return null
  return airportIndex.get(code.trim().toUpperCase()) ?? null
}

const airlineMap: Record<string, string> = {
  ...(airlinesRaw as Record<string, string>),
  ...(airlineOverrides as Record<string, string>),
}
export function lookupAirline(icao: string): string | null {
  if (!icao) return null
  return airlineMap[icao.trim().toUpperCase()] ?? null
}

const { regions, countries } = regionsRaw as { regions: Record<string, string>; countries: Record<string, string> }
export function regionName(code: string): string { return regions[code] ?? code }
export function countryName(code: string): string { return countries[code] ?? code }

export const groups = groupsRaw as { name: string; airports: string[] }[]
export const airportToGroup = new Map<string, string>()
for (const g of groups) for (const code of g.airports) airportToGroup.set(code.toUpperCase(), g.name)

const classRules = classesRaw as { pattern: string; class: AircraftClass }[]
export function classifyAircraft(typeName: string): AircraftClass {
  if (!typeName) return 'unclassified'
  const lower = typeName.toLowerCase()
  for (const r of classRules) if (lower.includes(r.pattern.toLowerCase())) return r.class
  return 'unclassified'
}

export type { Continent }
```

- [ ] **Step 4: Run the test**

Run: `npm --prefix /Users/vijayram/Cursor/flight_visualizer test -- reference`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git -C /Users/vijayram/Cursor/flight_visualizer add -A
git -C /Users/vijayram/Cursor/flight_visualizer commit -m "feat: reference loaders + lookup indexes (airport/airline/group/region/aircraft)"
```

---

## Task 7: CSV parser

**Files:**
- Create: `src/engine/parse.ts`
- Test: `src/test/engine/parse.test.ts`

**Interfaces:**
- Consumes: raw Flighty CSV text.
- Produces: `parseFlightyCsv(text: string): { rows: RawFlight[]; headerOk: boolean; missingColumns: string[] }`. `rawIndex` is the 0-based data-row position.

- [ ] **Step 1: Write `src/test/engine/parse.test.ts` (failing)**

```ts
import { describe, it, expect } from 'vitest'
import { parseFlightyCsv, REQUIRED_COLUMNS } from '../../engine/parse'

const HEADER = REQUIRED_COLUMNS.join(',')

describe('parseFlightyCsv', () => {
  it('parses a minute-precision row and a second-precision row', () => {
    const csv = [
      HEADER,
      // a 2006 minute-precision row
      '2006-07-06,AAL,66,DFW,ORD,,,,,false,,2006-07-06T13:50,2006-07-06T13:55,2006-07-06T14:10,2006-07-06T14:12,2006-07-06T16:09,2006-07-06T16:05,2006-07-06T16:09,2006-07-06T16:08,Boeing 777,,,,,,,,id1,,,,,',
      // a 2022 second-precision row
      '2022-05-01,AAL,100,DFW,LAX,,,,,false,,2022-05-01T08:00:00,2022-05-01T08:05:00,2022-05-01T08:20:00,2022-05-01T08:22:00,2022-05-01T10:30:00,2022-05-01T10:25:00,2022-05-01T10:40:00,2022-05-01T10:38:00,Airbus A321,,,,,,,,id2,,,,,',
    ].join('\n')
    const { rows, headerOk } = parseFlightyCsv(csv)
    expect(headerOk).toBe(true)
    expect(rows).toHaveLength(2)
    expect(rows[0].fromCode).toBe('DFW')
    expect(rows[0].takeoffActual).toBe('2006-07-06T14:12')
    expect(rows[1].takeoffActual).toBe('2022-05-01T08:22:00')
    expect(rows[0].canceled).toBe(false)
    expect(rows[0].rawIndex).toBe(0)
    expect(rows[1].rawIndex).toBe(1)
  })

  it('reports a bad header', () => {
    const { headerOk, missingColumns } = parseFlightyCsv('foo,bar\n1,2')
    expect(headerOk).toBe(false)
    expect(missingColumns).toContain('From')
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm --prefix /Users/vijayram/Cursor/flight_visualizer test -- parse`
Expected: FAIL (module not found).

- [ ] **Step 3: Write `src/engine/parse.ts`**

```ts
import Papa from 'papaparse'
import type { RawFlight } from './types'

export const REQUIRED_COLUMNS = [
  'Date', 'Airline', 'Flight', 'From', 'To', 'Dep Terminal', 'Dep Gate', 'Arr Terminal', 'Arr Gate',
  'Canceled', 'Diverted To', 'Gate Departure (Scheduled)', 'Gate Departure (Actual)',
  'Take off (Scheduled)', 'Take off (Actual)', 'Landing (Scheduled)', 'Landing (Actual)',
  'Gate Arrival (Scheduled)', 'Gate Arrival (Actual)', 'Aircraft Type Name', 'Tail Number',
  'PNR', 'Seat', 'Seat Type', 'Cabin Class', 'Flight Reason', 'Notes', 'Flight Flighty ID',
  'Airline Flighty ID', 'Departure Airport Flighty ID', 'Arrival Airport Flighty ID',
  'Diverted To Airport Flighty ID', 'Aircraft Type Flighty ID',
]

const g = (r: Record<string, string>, k: string) => (r[k] ?? '').trim()

export function parseFlightyCsv(text: string): { rows: RawFlight[]; headerOk: boolean; missingColumns: string[] } {
  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true, worker: false })
  const fields = parsed.meta.fields ?? []
  const missingColumns = ['Date', 'Airline', 'Flight', 'From', 'To', 'Canceled'].filter((c) => !fields.includes(c))
  const headerOk = missingColumns.length === 0
  const rows: RawFlight[] = parsed.data.map((r, i) => ({
    rawIndex: i,
    date: g(r, 'Date'),
    airlineCode: g(r, 'Airline'),
    flightNumber: g(r, 'Flight'),
    fromCode: g(r, 'From'),
    toCode: g(r, 'To'),
    canceled: g(r, 'Canceled').toLowerCase() === 'true',
    divertedToCode: g(r, 'Diverted To'),
    gateDepSched: g(r, 'Gate Departure (Scheduled)'),
    gateDepActual: g(r, 'Gate Departure (Actual)'),
    takeoffSched: g(r, 'Take off (Scheduled)'),
    takeoffActual: g(r, 'Take off (Actual)'),
    landingSched: g(r, 'Landing (Scheduled)'),
    landingActual: g(r, 'Landing (Actual)'),
    gateArrSched: g(r, 'Gate Arrival (Scheduled)'),
    gateArrActual: g(r, 'Gate Arrival (Actual)'),
    aircraftType: g(r, 'Aircraft Type Name'),
    tail: g(r, 'Tail Number'),
    pnr: g(r, 'PNR'),
    seat: g(r, 'Seat'),
    cabin: g(r, 'Cabin Class'),
    reason: g(r, 'Flight Reason'),
    notes: g(r, 'Notes'),
    flightyId: g(r, 'Flight Flighty ID'),
  }))
  return { rows, headerOk, missingColumns }
}
```

- [ ] **Step 4: Run the test**

Run: `npm --prefix /Users/vijayram/Cursor/flight_visualizer test -- parse`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git -C /Users/vijayram/Cursor/flight_visualizer add -A
git -C /Users/vijayram/Cursor/flight_visualizer commit -m "feat: Flighty CSV parser (both timestamp formats, header validation)"
```

---

## Task 8: Haversine distance

**Files:**
- Create: `src/engine/distance.ts`
- Test: `src/test/engine/distance.test.ts`

**Interfaces:**
- Produces: `haversineMi(aLat, aLon, bLat, bLon): number` (statute miles).

- [ ] **Step 1: Write `src/test/engine/distance.test.ts` (failing)**

```ts
import { describe, it, expect } from 'vitest'
import { haversineMi } from '../../engine/distance'

describe('haversineMi', () => {
  it('DFW->ORD is ~802 mi', () => {
    const d = haversineMi(32.8968, -97.0380, 41.9786, -87.9048)
    expect(d).toBeGreaterThan(798)
    expect(d).toBeLessThan(806)
  })
  it('identical points are 0', () => {
    expect(haversineMi(40, -100, 40, -100)).toBe(0)
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm --prefix /Users/vijayram/Cursor/flight_visualizer test -- distance`
Expected: FAIL.

- [ ] **Step 3: Write `src/engine/distance.ts`**

```ts
import { EARTH_RADIUS_MI } from './constants'

const rad = (d: number) => (d * Math.PI) / 180

export function haversineMi(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const dLat = rad(bLat - aLat)
  const dLon = rad(bLon - aLon)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_MI * Math.asin(Math.min(1, Math.sqrt(s)))
}
```

- [ ] **Step 4: Run the test**

Run: `npm --prefix /Users/vijayram/Cursor/flight_visualizer test -- distance`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git -C /Users/vijayram/Cursor/flight_visualizer add -A
git -C /Users/vijayram/Cursor/flight_visualizer commit -m "feat: haversine great-circle distance"
```

---

## Task 9: Timezone-aware duration fallback chain

**Files:**
- Create: `src/engine/duration.ts`
- Test: `src/test/engine/duration.test.ts`

**Interfaces:**
- Consumes: `Airport`, `RawFlight`, `DurationConstants`, `haversineMi`.
- Produces:
  - `localToUtcMs(localIso: string, tz: string): number | null` (Luxon; returns null on invalid).
  - `computeDuration(args: { from: Airport|null; to: Airport|null; raw: RawFlight; distanceMi: number|null; constants: DurationConstants }): { min: number|null; source: DurationSource|null }`.

- [ ] **Step 1: Write `src/test/engine/duration.test.ts` (failing)**

```ts
import { describe, it, expect } from 'vitest'
import { computeDuration, localToUtcMs } from '../../engine/duration'
import { lookupAirport } from '../../engine/reference'
import { DEFAULT_DURATION_CONSTANTS as C } from '../../engine/constants'
import type { RawFlight } from '../../engine/types'

const blankRaw = (over: Partial<RawFlight>): RawFlight => ({
  rawIndex: 0, date: '', airlineCode: '', flightNumber: '', fromCode: '', toCode: '',
  canceled: false, divertedToCode: '', gateDepSched: '', gateDepActual: '', takeoffSched: '',
  takeoffActual: '', landingSched: '', landingActual: '', gateArrSched: '', gateArrActual: '',
  aircraftType: '', tail: '', pnr: '', seat: '', cabin: '', reason: '', notes: '', flightyId: '',
  ...over,
})

describe('timezone-aware duration', () => {
  it('localToUtcMs respects the IANA zone', () => {
    const utc = localToUtcMs('2015-01-10T17:00', 'Asia/Tokyo')! // = 2015-01-10T08:00Z
    expect(new Date(utc).toISOString()).toBe('2015-01-10T08:00:00.000Z')
  })

  it('HND->DFW: naive subtraction is negative; tz-aware is +780min', () => {
    const from = lookupAirport('HND')!
    const to = lookupAirport('DFW')!
    const raw = blankRaw({ takeoffActual: '2015-01-10T17:00', landingActual: '2015-01-10T15:00' })
    const { min, source } = computeDuration({ from, to, raw, distanceMi: 6000, constants: C })
    expect(source).toBe('actual')
    expect(min).toBe(780)
  })

  it('falls back to the distance estimate when actuals are missing', () => {
    const from = lookupAirport('AUS')!
    const to = lookupAirport('DEN')!
    const raw = blankRaw({}) // no timestamps at all
    const { min, source } = computeDuration({ from, to, raw, distanceMi: 700, constants: C })
    expect(source).toBe('estimate')
    expect(min).toBe(Math.round(C.taxiMin + (700 / C.cruiseMph) * 60 + C.climbDescentMin)) // 30 + 84 + 15 = 129
  })

  it('zero-distance local flight uses gate-to-gate minus taxi (~20min for RPJ)', () => {
    const rpj = lookupAirport('RPJ')!
    const raw = blankRaw({ gateDepSched: '2013-08-18T12:00', gateArrSched: '2013-08-18T12:30' })
    const { min, source } = computeDuration({ from: rpj, to: rpj, raw, distanceMi: 0, constants: C })
    expect(source).toBe('gate')
    expect(min).toBe(20) // 30min gate - 10min gateTaxi
  })

  it('never returns a negative duration', () => {
    const from = lookupAirport('HND')!
    const to = lookupAirport('DFW')!
    const raw = blankRaw({ takeoffActual: '2015-01-10T17:00', landingActual: '2015-01-10T10:00' })
    const { min } = computeDuration({ from, to, raw, distanceMi: 6000, constants: C })
    expect(min).toBeGreaterThanOrEqual(0)
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm --prefix /Users/vijayram/Cursor/flight_visualizer test -- duration`
Expected: FAIL.

- [ ] **Step 3: Write `src/engine/duration.ts`**

```ts
import { DateTime } from 'luxon'
import type { Airport, RawFlight, DurationConstants, DurationSource } from './types'

export function localToUtcMs(localIso: string, tz: string): number | null {
  if (!localIso || !tz) return null
  const dt = DateTime.fromISO(localIso, { zone: tz })
  return dt.isValid ? dt.toMillis() : null
}

function pairMinutes(aIso: string, aTz: string, bIso: string, bTz: string): number | null {
  const a = localToUtcMs(aIso, aTz)
  const b = localToUtcMs(bIso, bTz)
  if (a === null || b === null) return null
  return (b - a) / 60000
}

const clampNonNeg = (n: number) => Math.max(0, n)

export function computeDuration(args: {
  from: Airport | null
  to: Airport | null
  raw: RawFlight
  distanceMi: number | null
  constants: DurationConstants
}): { min: number | null; source: DurationSource | null } {
  const { from, to, raw, distanceMi, constants: c } = args
  const fromTz = from?.tz ?? ''
  const toTz = to?.tz ?? ''

  // 1. actual air time
  if (raw.takeoffActual && raw.landingActual && fromTz && toTz) {
    const m = pairMinutes(raw.takeoffActual, fromTz, raw.landingActual, toTz)
    if (m !== null) return { min: Math.round(clampNonNeg(m)), source: 'actual' }
  }
  // 2. scheduled air time
  if (raw.takeoffSched && raw.landingSched && fromTz && toTz) {
    const m = pairMinutes(raw.takeoffSched, fromTz, raw.landingSched, toTz)
    if (m !== null) return { min: Math.round(clampNonNeg(m)), source: 'scheduled' }
  }
  // 3. gate-to-gate (actual then scheduled) minus taxi allowance
  const gateDep = raw.gateDepActual || raw.gateDepSched
  const gateArr = raw.gateArrActual || raw.gateArrSched
  if (gateDep && gateArr && fromTz && toTz) {
    const m = pairMinutes(gateDep, fromTz, gateArr, toTz)
    if (m !== null) {
      const air = clampNonNeg(m - c.gateTaxiMin)
      return { min: Math.round(Math.max(c.localFlightMinMin, air)), source: 'gate' }
    }
  }
  // 4a. zero-distance local flight with no usable times -> default
  if (distanceMi === 0) {
    return { min: c.localFlightDefaultMin, source: 'localDefault' }
  }
  // 4b. distance estimate
  if (distanceMi !== null && distanceMi > 0) {
    const est = c.taxiMin + (distanceMi / c.cruiseMph) * 60 + c.climbDescentMin
    return { min: Math.round(est), source: 'estimate' }
  }
  return { min: null, source: null }
}
```

- [ ] **Step 4: Run the test**

Run: `npm --prefix /Users/vijayram/Cursor/flight_visualizer test -- duration`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git -C /Users/vijayram/Cursor/flight_visualizer add -A
git -C /Users/vijayram/Cursor/flight_visualizer commit -m "feat: timezone-aware duration with gate + distance fallbacks"
```

---

## Task 10: Overrides (signature key + apply)

**Files:**
- Create: `src/engine/overrides.ts`
- Test: `src/test/engine/overrides.test.ts`

**Interfaces:**
- Consumes: `RawFlight`, `flight-overrides.json`.
- Produces:
  - `signatureOf(raw: RawFlight): string` = `${date}|${fromCode}|${toCode}|${gateDepSched}`.
  - `overrideFor(raw: RawFlight): FlightOverride | null`.
  - type `FlightOverride = { signature: string; durationMinOverride?: number|null; distanceMiOverride?: number|null; from?: string; to?: string; exclude?: boolean; note?: string }`.

- [ ] **Step 1: Write `src/test/engine/overrides.test.ts` (failing)**

```ts
import { describe, it, expect } from 'vitest'
import { signatureOf, overrideFor } from '../../engine/overrides'
import type { RawFlight } from '../../engine/types'

const raw = (over: Partial<RawFlight>): RawFlight => ({
  rawIndex: 0, date: '2013-08-18', airlineCode: '', flightNumber: '', fromCode: 'RPJ', toCode: 'RPJ',
  canceled: false, divertedToCode: '', gateDepSched: '2013-08-18T12:00', gateDepActual: '', takeoffSched: '',
  takeoffActual: '', landingSched: '', landingActual: '', gateArrSched: '2013-08-18T12:30', gateArrActual: '',
  aircraftType: 'DHC-6 Twin Otter', tail: 'N901ST', pnr: '', seat: '', cabin: '', reason: '', notes: '', flightyId: '',
  ...over,
})

describe('overrides', () => {
  it('builds the signature', () => {
    expect(signatureOf(raw({}))).toBe('2013-08-18|RPJ|RPJ|2013-08-18T12:00')
  })
  it('matches the seeded RPJ override', () => {
    expect(overrideFor(raw({}))).not.toBeNull()
  })
  it('returns null for a non-matching flight', () => {
    expect(overrideFor(raw({ date: '2020-01-01', gateDepSched: '2020-01-01T09:00' }))).toBeNull()
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm --prefix /Users/vijayram/Cursor/flight_visualizer test -- overrides`
Expected: FAIL.

- [ ] **Step 3: Write `src/engine/overrides.ts`**

```ts
import type { RawFlight } from './types'
import raw from '../reference/flight-overrides.json'

export interface FlightOverride {
  signature: string
  durationMinOverride?: number | null
  distanceMiOverride?: number | null
  from?: string
  to?: string
  exclude?: boolean
  note?: string
}

const overrides = (raw as { overrides: FlightOverride[] }).overrides ?? []
const index = new Map<string, FlightOverride>()
for (const o of overrides) index.set(o.signature, o)

export function signatureOf(r: RawFlight): string {
  return `${r.date}|${r.fromCode}|${r.toCode}|${r.gateDepSched}`
}

export function overrideFor(r: RawFlight): FlightOverride | null {
  return index.get(signatureOf(r)) ?? null
}
```

- [ ] **Step 4: Run the test**

Run: `npm --prefix /Users/vijayram/Cursor/flight_visualizer test -- overrides`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git -C /Users/vijayram/Cursor/flight_visualizer add -A
git -C /Users/vijayram/Cursor/flight_visualizer commit -m "feat: per-flight override signature + lookup"
```

---

## Task 11: Enrich (RawFlight -> EnrichedFlight)

**Files:**
- Create: `src/engine/enrich.ts`
- Test: `src/test/engine/enrich.test.ts`

**Interfaces:**
- Consumes: everything above + `today` (a `YYYY-MM-DD` string, injected).
- Produces: `enrichFlight(raw: RawFlight, today: string, constants: DurationConstants): EnrichedFlight`.

Rules implemented (from spec §4.2/§4.4):
- Diverted → effective `toCode` = `divertedToCode`, `intendedToCode` = original `toCode`.
- `from`/`to` via `lookupAirport`; `resolved` = both non-null.
- `distanceMi` = haversine if resolved, else null; **0 when From==To** (local flight).
- `isLocalFlight` = resolved && fromCode-effective == toCode-effective (same airport).
- `durationMin`/`durationSource` via `computeDuration`; **override wins** (`durationMinOverride`/`distanceMiOverride`, source `'override'`).
- `delayMin` = tz-safe gate-arrival actual − scheduled (same airport, so single tz); null if either missing.
- `flown` = has any actual time OR `date <= today`.
- `depHourLocal`/`arrHourLocal` = hour parsed from raw local takeoff-actual||gate-dep / landing-actual||gate-arr (no tz shift).
- `excluded` = override.exclude === true.
- `airlineName` = `lookupAirline(code)` || (code || 'Unknown airline').
- `aircraftClass` = `classifyAircraft(type)`.

- [ ] **Step 1: Write `src/test/engine/enrich.test.ts` (failing)**

```ts
import { describe, it, expect } from 'vitest'
import { enrichFlight } from '../../engine/enrich'
import { DEFAULT_DURATION_CONSTANTS as C } from '../../engine/constants'
import { parseFlightyCsv } from '../../engine/parse'
import { REQUIRED_COLUMNS } from '../../engine/parse'

const H = REQUIRED_COLUMNS.join(',')
const one = (line: string) => parseFlightyCsv([H, line].join('\n')).rows[0]
const TODAY = '2026-06-25'

describe('enrichFlight', () => {
  it('resolves names, distance, class, and delay', () => {
    const raw = one('2022-05-01,AAL,100,DFW,ORD,,,,,false,,2022-05-01T08:00:00,,2022-05-01T08:20:00,2022-05-01T08:25:00,2022-05-01T10:00:00,2022-05-01T09:55:00,2022-05-01T10:10:00,2022-05-01T10:20:00,Boeing 777,,,,,,,,id,,,,,')
    const f = enrichFlight(raw, TODAY, C)
    expect(f.airlineName).toMatch(/American/i)
    expect(f.distanceMi).toBeGreaterThan(798)
    expect(f.aircraftClass).toBe('wide')
    expect(f.delayMin).toBe(10) // gate arr actual 10:20 vs sched 10:10
    expect(f.flown).toBe(true)
  })

  it('treats RPJ->RPJ as a local flight: distance 0, ~20min, counts (not excluded)', () => {
    const raw = one('2013-08-18,,,RPJ,RPJ,,,,,false,,2013-08-18T12:00,,,,,,2013-08-18T12:30,,DHC-6 Twin Otter,N901ST,,,,,,,,,,,')
    const f = enrichFlight(raw, TODAY, C)
    expect(f.isLocalFlight).toBe(true)
    expect(f.distanceMi).toBe(0)
    expect(f.durationMin).toBe(20)
    expect(f.excluded).toBe(false)
    expect(f.airlineName).toBe('Unknown airline')
  })

  it('diverts: effective To = diverted-to, intended kept', () => {
    const raw = one('2019-07-10,AAL,1373,DFW,LBB,,,,,false,SPS,2019-07-10T18:00,,,,,,,,Boeing 737-800,,,,,,,,,,,')
    const f = enrichFlight(raw, TODAY, C)
    expect(f.toCode).toBe('SPS')
    expect(f.intendedToCode).toBe('LBB')
    expect(f.diverted).toBe(true)
  })

  it('flags an unresolved endpoint', () => {
    const raw = one('2020-01-01,AAL,1,ZZZ,DFW,,,,,false,,2020-01-01T09:00,,,,,,,,Boeing 737,,,,,,,,,,,')
    const f = enrichFlight(raw, TODAY, C)
    expect(f.resolved).toBe(false)
    expect(f.distanceMi).toBeNull()
  })

  it('marks a future-dated row as not flown', () => {
    const raw = one('2026-08-22,AAL,2,DFW,LAX,,,,,false,,,,,,,,,,Airbus A321,,,,,,,,,,,')
    const f = enrichFlight(raw, TODAY, C)
    expect(f.flown).toBe(false)
  })

  it('reads departure hour from raw local time (no tz shift)', () => {
    const raw = one('2015-06-01,AAL,3,DFW,LAX,,,,,false,,2015-06-01T08:30,2015-06-01T08:35,,,,,,,Airbus A321,,,,,,,,,,,')
    const f = enrichFlight(raw, TODAY, C)
    expect(f.depHourLocal).toBe(8)
  })

  it('applies an override (exclude / duration)', () => {
    // override file seeds RPJ with durationMinOverride:null, so duration stays data-derived (20);
    // here we just assert the override path does not crash and keeps the flight.
    const raw = one('2013-08-18,,,RPJ,RPJ,,,,,false,,2013-08-18T12:00,,,,,,2013-08-18T12:30,,DHC-6 Twin Otter,N901ST,,,,,,,,,,,')
    const f = enrichFlight(raw, TODAY, C)
    expect(f.excluded).toBe(false)
    expect(f.durationMin).toBe(20)
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm --prefix /Users/vijayram/Cursor/flight_visualizer test -- enrich`
Expected: FAIL.

- [ ] **Step 3: Write `src/engine/enrich.ts`**

```ts
import type { EnrichedFlight, RawFlight, DurationConstants } from './types'
import { lookupAirport, lookupAirline, classifyAircraft } from './reference'
import { haversineMi } from './distance'
import { computeDuration } from './duration'
import { overrideFor } from './overrides'

function hourOf(localIso: string): number | null {
  const m = /T(\d{2}):/.exec(localIso)
  return m ? Number(m[1]) : null
}

export function enrichFlight(raw: RawFlight, today: string, constants: DurationConstants): EnrichedFlight {
  const ov = overrideFor(raw)
  const fromCode = (ov?.from ?? raw.fromCode).toUpperCase()
  const diverted = raw.divertedToCode !== ''
  const effectiveToRaw = ov?.to ?? (diverted ? raw.divertedToCode : raw.toCode)
  const toCode = effectiveToRaw.toUpperCase()
  const intendedToCode = diverted ? raw.toCode.toUpperCase() : null

  const from = lookupAirport(fromCode)
  const to = lookupAirport(toCode)
  const resolved = !!from && !!to
  const isLocalFlight = resolved && fromCode === toCode

  let distanceMi: number | null = null
  if (ov?.distanceMiOverride != null) distanceMi = ov.distanceMiOverride
  else if (isLocalFlight) distanceMi = 0
  else if (resolved) distanceMi = haversineMi(from!.lat, from!.lon, to!.lat, to!.lon)

  let durationMin: number | null
  let durationSource: EnrichedFlight['durationSource']
  if (ov?.durationMinOverride != null) {
    durationMin = ov.durationMinOverride
    durationSource = 'override'
  } else {
    const d = computeDuration({ from, to, raw, distanceMi, constants })
    durationMin = d.min
    durationSource = d.source
  }

  // delay: gate-arrival actual vs scheduled at the SAME airport (single tz -> naive diff is safe)
  let delayMin: number | null = null
  if (raw.gateArrActual && raw.gateArrSched) {
    const a = Date.parse(raw.gateArrActual)
    const s = Date.parse(raw.gateArrSched)
    if (Number.isFinite(a) && Number.isFinite(s)) delayMin = Math.round((a - s) / 60000)
  }

  const hasActual = !!(raw.takeoffActual || raw.landingActual || raw.gateDepActual || raw.gateArrActual)
  const flown = hasActual || raw.date <= today

  const airlineName = lookupAirline(raw.airlineCode) ?? (raw.airlineCode || 'Unknown airline')

  return {
    id: raw.flightyId || `row:${raw.rawIndex}`,
    rawIndex: raw.rawIndex,
    date: raw.date,
    year: Number(raw.date.slice(0, 4)) || 0,
    airlineCode: raw.airlineCode,
    airlineName,
    flightNumber: raw.flightNumber,
    fromCode,
    toCode,
    intendedToCode,
    from,
    to,
    resolved,
    distanceMi,
    durationMin,
    durationSource,
    delayMin,
    depHourLocal: hourOf(raw.takeoffActual || raw.gateDepActual || raw.takeoffSched || raw.gateDepSched),
    arrHourLocal: hourOf(raw.landingActual || raw.gateArrActual || raw.landingSched || raw.gateArrSched),
    canceled: raw.canceled,
    diverted,
    flown,
    isLocalFlight,
    excluded: ov?.exclude === true,
    aircraftType: raw.aircraftType,
    aircraftClass: classifyAircraft(raw.aircraftType),
    tail: raw.tail,
    seat: raw.seat,
    cabin: raw.cabin,
    pnr: raw.pnr,
    notes: raw.notes,
  }
}
```

- [ ] **Step 4: Run the test**

Run: `npm --prefix /Users/vijayram/Cursor/flight_visualizer test -- enrich`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git -C /Users/vijayram/Cursor/flight_visualizer add -A
git -C /Users/vijayram/Cursor/flight_visualizer commit -m "feat: enrich raw flights (distance, tz duration, divert, delay, flown, overrides)"
```

---

## Task 12: Normalize route/airport identity (group × unique)

**Files:**
- Create: `src/engine/normalize.ts`
- Test: `src/test/engine/normalize.test.ts`

**Interfaces:**
- Consumes: `EnrichedFlight`, `airportToGroup`, `Settings`.
- Produces:
  - `airportKey(code: string, groupAirports: boolean): string` (group name if grouped & known, else the code).
  - `routeKey(f: EnrichedFlight, settings: Settings): string | null` — null for unresolved or local (From==To) flights. Endpoints mapped through grouping; when `!explicitlyUnique`, endpoints sorted so direction collapses. Returns `"A→B"` (unique) or `"A↔B"` (collapsed).
  - `routeIsSelfLoop(f, settings): boolean` — true when grouping collapses both endpoints to the same key.

- [ ] **Step 1: Write `src/test/engine/normalize.test.ts` (failing)**

```ts
import { describe, it, expect } from 'vitest'
import { airportKey, routeKey } from '../../engine/normalize'
import { enrichFlight } from '../../engine/enrich'
import { parseFlightyCsv, REQUIRED_COLUMNS } from '../../engine/parse'
import { DEFAULT_DURATION_CONSTANTS as C } from '../../engine/constants'
import type { Settings } from '../../engine/types'

const H = REQUIRED_COLUMNS.join(',')
const f = (from: string, to: string) =>
  enrichFlight(parseFlightyCsv([H, `2018-01-01,AAL,1,${from},${to},,,,,false,,2018-01-01T09:00,,,,,,,,Boeing 737,,,,,,,,,,,`].join('\n')).rows[0], '2026-06-25', C)

const settings = (over: Partial<Settings>): Settings => ({
  groupAirports: false, explicitlyUnique: true, includeCanceled: false, excludeBeforeDate: null, duration: C, ...over,
})

describe('normalize', () => {
  it('airportKey groups when enabled', () => {
    expect(airportKey('DFW', true)).toBe('Dallas')
    expect(airportKey('DFW', false)).toBe('DFW')
    expect(airportKey('AUS', true)).toBe('AUS') // not in any group
  })

  it('§5.2: group on + unique off collapses DFW->SFO, OAK->DAL, SFO->DFW to one route', () => {
    const s = settings({ groupAirports: true, explicitlyUnique: false })
    const keys = new Set([routeKey(f('DFW', 'SFO'), s), routeKey(f('OAK', 'DAL'), s), routeKey(f('SFO', 'DFW'), s)])
    expect(keys.size).toBe(1)
  })

  it('group off + unique on keeps all three distinct', () => {
    const s = settings({ groupAirports: false, explicitlyUnique: true })
    const keys = new Set([routeKey(f('DFW', 'SFO'), s), routeKey(f('OAK', 'DAL'), s), routeKey(f('SFO', 'DFW'), s)])
    expect(keys.size).toBe(3)
  })

  it('returns null for a grouped self-loop (DAL->DFW under grouping)', () => {
    const s = settings({ groupAirports: true, explicitlyUnique: true })
    expect(routeKey(f('DAL', 'DFW'), s)).toBeNull()
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm --prefix /Users/vijayram/Cursor/flight_visualizer test -- normalize`
Expected: FAIL.

- [ ] **Step 3: Write `src/engine/normalize.ts`**

```ts
import type { EnrichedFlight, Settings } from './types'
import { airportToGroup } from './reference'

export function airportKey(code: string, groupAirports: boolean): string {
  if (!groupAirports) return code
  return airportToGroup.get(code.toUpperCase()) ?? code
}

export function routeKey(f: EnrichedFlight, settings: Settings): string | null {
  if (!f.resolved || f.isLocalFlight) return null
  const a = airportKey(f.fromCode, settings.groupAirports)
  const b = airportKey(f.toCode, settings.groupAirports)
  if (a === b) return null // collapsed self-loop
  if (settings.explicitlyUnique) return `${a}→${b}`
  return [a, b].sort().join('↔')
}
```

- [ ] **Step 4: Run the test**

Run: `npm --prefix /Users/vijayram/Cursor/flight_visualizer test -- normalize`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git -C /Users/vijayram/Cursor/flight_visualizer add -A
git -C /Users/vijayram/Cursor/flight_visualizer commit -m "feat: route/airport identity normalization (group x unique)"
```

---

## Task 13: Classify routes (super-domestic tiers + intercontinental, HNL rule)

**Files:**
- Create: `src/engine/classify.ts`
- Test: `src/test/engine/classify.test.ts`

**Interfaces:**
- Consumes: `EnrichedFlight` (with resolved `from`/`to`).
- Produces: `classifyRoute(f: EnrichedFlight): 'intra-state' | 'intra-country' | 'intra-continent' | 'intercontinental' | null`. Null for unresolved/local. **Continent-first:** different continent → `'intercontinental'` (so HNL↔mainland is intercontinental, never intra-USA). Same continent + same country + same region → `'intra-state'`; same continent + same country → `'intra-country'`; same continent only → `'intra-continent'`.

- [ ] **Step 1: Write `src/test/engine/classify.test.ts` (failing)**

```ts
import { describe, it, expect } from 'vitest'
import { classifyRoute } from '../../engine/classify'
import { enrichFlight } from '../../engine/enrich'
import { parseFlightyCsv, REQUIRED_COLUMNS } from '../../engine/parse'
import { DEFAULT_DURATION_CONSTANTS as C } from '../../engine/constants'

const H = REQUIRED_COLUMNS.join(',')
const f = (from: string, to: string) =>
  enrichFlight(parseFlightyCsv([H, `2018-01-01,AAL,1,${from},${to},,,,,false,,2018-01-01T09:00,,,,,,,,Boeing 737,,,,,,,,,,,`].join('\n')).rows[0], '2026-06-25', C)

describe('classifyRoute', () => {
  it('DFW->AUS is intra-state (both US-TX)', () => {
    expect(classifyRoute(f('DFW', 'AUS'))).toBe('intra-state')
  })
  it('DFW->ORD is intra-country (US, NA)', () => {
    expect(classifyRoute(f('DFW', 'ORD'))).toBe('intra-country')
  })
  it('LHR->CDG is intra-continent (EU, different countries)', () => {
    expect(classifyRoute(f('LHR', 'CDG'))).toBe('intra-continent')
  })
  it('HNL->DFW is intercontinental (OC vs NA), not intra-USA', () => {
    expect(classifyRoute(f('HNL', 'DFW'))).toBe('intercontinental')
  })
  it('DFW->LHR is intercontinental', () => {
    expect(classifyRoute(f('DFW', 'LHR'))).toBe('intercontinental')
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm --prefix /Users/vijayram/Cursor/flight_visualizer test -- classify`
Expected: FAIL.

- [ ] **Step 3: Write `src/engine/classify.ts`**

```ts
import type { EnrichedFlight } from './types'

export type RouteClass = 'intra-state' | 'intra-country' | 'intra-continent' | 'intercontinental'

export function classifyRoute(f: EnrichedFlight): RouteClass | null {
  if (!f.resolved || f.isLocalFlight || !f.from || !f.to) return null
  if (f.from.continent !== f.to.continent) return 'intercontinental'
  if (f.from.country !== f.to.country) return 'intra-continent'
  if (f.from.region !== f.to.region) return 'intra-country'
  return 'intra-state'
}
```

- [ ] **Step 4: Run the test**

Run: `npm --prefix /Users/vijayram/Cursor/flight_visualizer test -- classify`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git -C /Users/vijayram/Cursor/flight_visualizer add -A
git -C /Users/vijayram/Cursor/flight_visualizer commit -m "feat: route classification (continent-first tiers; HNL intercontinental)"
```

---

## Task 14: Filter + aggregate helpers + milestones

**Files:**
- Create: `src/engine/filter.ts`, `src/engine/aggregate.ts`
- Test: `src/test/engine/aggregate.test.ts`

**Interfaces:**
- Consumes: `EnrichedFlight[]`, `Settings`, `today`.
- Produces (filter.ts):
  - `applyFilters(flights, settings, today, scopeYear?): EnrichedFlight[]` — drops `excluded`; drops `!flown` (upcoming); drops `canceled` unless `includeCanceled`; drops `date < excludeBeforeDate`; if `scopeYear` given, keeps that year only.
- Produces (aggregate.ts):
  - `byAirport(flights, settings): { key: string; count: number }[]` (each flight credits both endpoints; grouped per settings; sorted desc).
  - `byRoute(flights, settings): { key: string; count: number; miles: number }[]` (uses `routeKey`, skips null).
  - `byAirline(flights): { name: string; count: number }[]` (excludes "Unknown airline" from the list).
  - `distanceBuckets(flights): { label: string; count: number }[]` (bands from spec §6.1 #2).
  - `byYear(flights): { year: number; count: number }[]` (desc).
  - `milestones(allFlown: EnrichedFlight[], ordinals: number[]): { ordinal: number; flight: EnrichedFlight }[]` — orders by best departure timestamp then `rawIndex`; computed over the passed flown set BEFORE scope/exclude filtering.
  - `totals(flights): { count: number; miles: number; minutes: number; uniqueAirports: number; airlines: number; uniqueRoutes: number }` — uniqueAirports/uniqueRoutes are plain distinct counts honoring grouping but NOT direction (per spec overview exception).

- [ ] **Step 1: Write `src/test/engine/aggregate.test.ts` (failing)**

```ts
import { describe, it, expect } from 'vitest'
import { applyFilters } from '../../engine/filter'
import { byAirport, byRoute, byAirline, distanceBuckets, milestones, totals } from '../../engine/aggregate'
import { enrichFlight } from '../../engine/enrich'
import { parseFlightyCsv, REQUIRED_COLUMNS } from '../../engine/parse'
import { DEFAULT_DURATION_CONSTANTS as C } from '../../engine/constants'
import type { Settings } from '../../engine/types'

const H = REQUIRED_COLUMNS.join(',')
const TODAY = '2026-06-25'
const mk = (line: string) => enrichFlight(parseFlightyCsv([H, line].join('\n')).rows[0], TODAY, C)
const route = (from: string, to: string, date = '2018-01-01') =>
  mk(`${date},AAL,1,${from},${to},,,,,false,,${date}T09:00,,,,,,,,Boeing 737,,,,,,,,,,,`)
const S = (over: Partial<Settings> = {}): Settings => ({
  groupAirports: false, explicitlyUnique: true, includeCanceled: false, excludeBeforeDate: null, duration: C, ...over,
})

describe('filter', () => {
  it('drops canceled by default but keeps when included', () => {
    const cx = mk('2018-01-01,AAL,1,DFW,AUS,,,,,true,,2018-01-01T09:00,,,,,,,,Boeing 737,,,,,,,,,,,')
    expect(applyFilters([cx], S(), TODAY)).toHaveLength(0)
    expect(applyFilters([cx], S({ includeCanceled: true }), TODAY)).toHaveLength(1)
  })
  it('drops future/upcoming flights', () => {
    const up = route('DFW', 'LAX', '2026-08-22')
    expect(applyFilters([up], S(), TODAY)).toHaveLength(0)
  })
  it('honors excludeBeforeDate', () => {
    expect(applyFilters([route('DFW', 'AUS', '2001-01-01')], S({ excludeBeforeDate: '2002-01-01' }), TODAY)).toHaveLength(0)
  })
})

describe('aggregate', () => {
  it('byAirport credits both endpoints and groups', () => {
    const res = byAirport([route('DFW', 'AUS'), route('DAL', 'AUS')], S({ groupAirports: true }))
    const dallas = res.find((r) => r.key === 'Dallas')!
    expect(dallas.count).toBe(2) // DFW + DAL collapse to Dallas
    expect(res.find((r) => r.key === 'AUS')!.count).toBe(2)
  })
  it('byRoute collapses with grouping+undirected', () => {
    const res = byRoute([route('DFW', 'SFO'), route('SFO', 'DFW')], S({ groupAirports: true, explicitlyUnique: false }))
    expect(res).toHaveLength(1)
    expect(res[0].count).toBe(2)
  })
  it('byAirline excludes Unknown', () => {
    const unknown = mk('2013-08-18,,,RPJ,RPJ,,,,,false,,2013-08-18T12:00,,,,,,2013-08-18T12:30,,DHC-6 Twin Otter,,,,,,,,,,,,')
    const res = byAirline([route('DFW', 'AUS'), unknown])
    expect(res.some((r) => r.name === 'Unknown airline')).toBe(false)
  })
  it('distanceBuckets bins by mileage', () => {
    const res = distanceBuckets([route('DFW', 'AUS'), route('DFW', 'LHR')]) // ~190mi, ~4700mi
    const short = res.find((b) => b.label.includes('<300'))!
    expect(short.count).toBe(1)
  })
  it('totals uses undirected unique routes honoring the overview exception', () => {
    const t = totals([route('DFW', 'SFO'), route('SFO', 'DFW')], S({ explicitlyUnique: true }))
    expect(t.uniqueRoutes).toBe(1) // overview ignores direction
    expect(t.count).toBe(2)
  })
})

describe('milestones', () => {
  it('orders by departure timestamp then rawIndex; works with blank Flighty ID', () => {
    const a = route('DFW', 'AUS', '2010-01-01')
    const b = route('DFW', 'ORD', '2012-01-01')
    const res = milestones([b, a], [1, 2]) // pass out of order; ordinals 1st & 2nd
    expect(res[0].flight.date).toBe('2010-01-01')
    expect(res[1].flight.date).toBe('2012-01-01')
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm --prefix /Users/vijayram/Cursor/flight_visualizer test -- aggregate`
Expected: FAIL.

- [ ] **Step 3: Write `src/engine/filter.ts`**

```ts
import type { EnrichedFlight, Settings } from './types'

export function applyFilters(
  flights: EnrichedFlight[],
  settings: Settings,
  _today: string,
  scopeYear?: number,
): EnrichedFlight[] {
  return flights.filter((f) => {
    if (f.excluded) return false
    if (!f.flown) return false
    if (f.canceled && !settings.includeCanceled) return false
    if (settings.excludeBeforeDate && f.date < settings.excludeBeforeDate) return false
    if (scopeYear !== undefined && f.year !== scopeYear) return false
    return true
  })
}
```

- [ ] **Step 4: Write `src/engine/aggregate.ts`**

```ts
import type { EnrichedFlight, Settings } from './types'
import { airportKey, routeKey } from './normalize'

function countMap<T>(items: T[], keyOf: (t: T) => string | null): Map<string, number> {
  const m = new Map<string, number>()
  for (const it of items) {
    const k = keyOf(it)
    if (k === null) continue
    m.set(k, (m.get(k) ?? 0) + 1)
  }
  return m
}

export function byAirport(flights: EnrichedFlight[], settings: Settings): { key: string; count: number }[] {
  const m = new Map<string, number>()
  for (const f of flights) {
    if (!f.resolved) continue
    const keys = f.isLocalFlight
      ? [airportKey(f.fromCode, settings.groupAirports)]
      : [airportKey(f.fromCode, settings.groupAirports), airportKey(f.toCode, settings.groupAirports)]
    for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1)
  }
  return [...m].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count)
}

export function byRoute(flights: EnrichedFlight[], settings: Settings): { key: string; count: number; miles: number }[] {
  const m = new Map<string, { count: number; miles: number }>()
  for (const f of flights) {
    const k = routeKey(f, settings)
    if (k === null) continue
    const cur = m.get(k) ?? { count: 0, miles: 0 }
    cur.count += 1
    cur.miles += f.distanceMi ?? 0
    m.set(k, cur)
  }
  return [...m].map(([key, v]) => ({ key, ...v })).sort((a, b) => b.count - a.count)
}

export function byAirline(flights: EnrichedFlight[]): { name: string; count: number }[] {
  const m = countMap(flights, (f) => (f.airlineName === 'Unknown airline' ? null : f.airlineName))
  return [...m].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
}

const BUCKETS: { label: string; max: number }[] = [
  { label: '<300 mi', max: 300 },
  { label: '300–700 mi', max: 700 },
  { label: '700–1,500 mi', max: 1500 },
  { label: '1,500–3,000 mi', max: 3000 },
  { label: '3,000–6,000 mi', max: 6000 },
  { label: '6,000+ mi', max: Infinity },
]

export function distanceBuckets(flights: EnrichedFlight[]): { label: string; count: number }[] {
  const counts = BUCKETS.map((b) => ({ label: b.label, count: 0 }))
  for (const f of flights) {
    if (f.distanceMi === null || f.distanceMi <= 0) continue
    const i = BUCKETS.findIndex((b) => f.distanceMi! < b.max)
    if (i >= 0) counts[i].count += 1
  }
  return counts
}

export function byYear(flights: EnrichedFlight[]): { year: number; count: number }[] {
  const m = countMap(flights, (f) => String(f.year))
  return [...m].map(([y, count]) => ({ year: Number(y), count })).sort((a, b) => b.year - a.year)
}

function depTs(f: EnrichedFlight): number {
  const iso = f.date // good enough as a coarse key; rawIndex breaks ties
  const t = Date.parse(iso)
  return Number.isFinite(t) ? t : 0
}

export function milestones(allFlown: EnrichedFlight[], ordinals: number[]): { ordinal: number; flight: EnrichedFlight }[] {
  const ordered = [...allFlown].sort((a, b) => depTs(a) - depTs(b) || a.rawIndex - b.rawIndex)
  return ordinals
    .filter((n) => n >= 1 && n <= ordered.length)
    .map((n) => ({ ordinal: n, flight: ordered[n - 1] }))
}

export function totals(flights: EnrichedFlight[], settings: Settings) {
  const miles = flights.reduce((s, f) => s + (f.distanceMi ?? 0), 0)
  const minutes = flights.reduce((s, f) => s + (f.durationMin ?? 0), 0)
  const airportSet = new Set<string>()
  for (const f of flights) {
    if (!f.resolved) continue
    airportSet.add(airportKey(f.fromCode, settings.groupAirports))
    if (!f.isLocalFlight) airportSet.add(airportKey(f.toCode, settings.groupAirports))
  }
  // overview unique routes: always undirected, grouping applied
  const undirected: Settings = { ...settings, explicitlyUnique: false }
  const routeSet = new Set<string>()
  for (const f of flights) {
    const k = routeKey(f, undirected)
    if (k !== null) routeSet.add(k)
  }
  const airlines = new Set(flights.map((f) => f.airlineName).filter((n) => n !== 'Unknown airline'))
  return {
    count: flights.length,
    miles: Math.round(miles),
    minutes,
    uniqueAirports: airportSet.size,
    airlines: airlines.size,
    uniqueRoutes: routeSet.size,
  }
}
```

- [ ] **Step 5: Run the test**

Run: `npm --prefix /Users/vijayram/Cursor/flight_visualizer test -- aggregate`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git -C /Users/vijayram/Cursor/flight_visualizer add -A
git -C /Users/vijayram/Cursor/flight_visualizer commit -m "feat: filtering + aggregate helpers + milestones"
```

---

## Task 15: Public API (`buildModel`) + golden fixture + real-CSV smoke test

**Files:**
- Create: `src/engine/index.ts`
- Create: `src/test/fixtures/golden.csv`
- Test: `src/test/engine/model.test.ts`, `src/test/engine/realcsv.test.ts`

**Interfaces:**
- Produces: `buildModel(csvText: string, settings: Settings, today: string, scopeYear?: number)` returning `{ headerOk, missingColumns, all: EnrichedFlight[], flown: EnrichedFlight[], scoped: EnrichedFlight[], unresolved: EnrichedFlight[], years: number[], totals, byAirport, byRoute, byAirline, distanceBuckets }`. This is the single entry point the UI (Phase 1) will call.

- [ ] **Step 1: Write `src/engine/index.ts`**

```ts
import type { Settings } from './types'
import { parseFlightyCsv } from './parse'
import { enrichFlight } from './enrich'
import { applyFilters } from './filter'
import { byAirport, byRoute, byAirline, distanceBuckets, byYear, totals } from './aggregate'
import { DEFAULT_DURATION_CONSTANTS } from './constants'

export const DEFAULT_SETTINGS: Settings = {
  groupAirports: true,
  explicitlyUnique: false,
  includeCanceled: false,
  excludeBeforeDate: null,
  duration: DEFAULT_DURATION_CONSTANTS,
}

export function buildModel(csvText: string, settings: Settings, today: string, scopeYear?: number) {
  const { rows, headerOk, missingColumns } = parseFlightyCsv(csvText)
  const all = rows.map((r) => enrichFlight(r, today, settings.duration))
  const flown = applyFilters(all, settings, today)
  const scoped = applyFilters(all, settings, today, scopeYear)
  const unresolved = all.filter((f) => !f.resolved && !f.excluded)
  const years = byYear(flown).map((y) => y.year)
  return {
    headerOk,
    missingColumns,
    all,
    flown,
    scoped,
    unresolved,
    years,
    totals: totals(scoped, settings),
    byAirport: byAirport(scoped, settings),
    byRoute: byRoute(scoped, settings),
    byAirline: byAirline(scoped),
    distanceBuckets: distanceBuckets(scoped),
  }
}

export * from './types'
```

- [ ] **Step 2: Write `src/test/fixtures/golden.csv`** (12 rows; header from `REQUIRED_COLUMNS`)

```
Date,Airline,Flight,From,To,Dep Terminal,Dep Gate,Arr Terminal,Arr Gate,Canceled,Diverted To,Gate Departure (Scheduled),Gate Departure (Actual),Take off (Scheduled),Take off (Actual),Landing (Scheduled),Landing (Actual),Gate Arrival (Scheduled),Gate Arrival (Actual),Aircraft Type Name,Tail Number,PNR,Seat,Seat Type,Cabin Class,Flight Reason,Notes,Flight Flighty ID,Airline Flighty ID,Departure Airport Flighty ID,Arrival Airport Flighty ID,Diverted To Airport Flighty ID,Aircraft Type Flighty ID
2015-01-05,AAL,66,DFW,ORD,,,,,false,,2015-01-05T13:00,2015-01-05T13:05,2015-01-05T13:20,2015-01-05T13:25,2015-01-05T15:00,2015-01-05T14:55,2015-01-05T15:10,2015-01-05T15:08,Boeing 777,N1,,,,,,,g1,,,,,
2015-01-10,JAL,1,HND,DFW,,,,,false,,2015-01-10T16:45,,2015-01-10T17:00,2015-01-10T17:00,2015-01-10T14:45,2015-01-10T15:00,2015-01-10T15:10,,Boeing 787,N2,,,,,,,g2,,,,,
2016-03-01,AAL,200,AUS,DEN,,,,,false,,2016-03-01T09:00,,,,,,,,Airbus A320,N3,,,,,,,g3,,,,,
2017-06-01,AAL,300,DFW,AUS,,,,,true,,2017-06-01T09:00,,,,,,,,Airbus A321,N4,,,,,,,g4,,,,,
2017-06-02,AAL,301,DFW,LBB,,,,,false,SPS,2017-06-02T18:00,2017-06-02T18:10,,,,,,,Boeing 737-800,N5,,,,,,,g5,,,,,
2018-02-01,UAL,400,DFW,SFO,,,,,false,,2018-02-01T07:00,,,,,,,,Boeing 737,N6,,,,,,,g6,,,,,
2018-02-02,UAL,401,OAK,DAL,,,,,false,,2018-02-02T07:00,,,,,,,,Boeing 737,N7,,,,,,,g7,,,,,
2018-02-03,UAL,402,SFO,DFW,,,,,false,,2018-02-03T07:00,,,,,,,,Boeing 737,N8,,,,,,,g8,,,,,
2013-08-18,,,RPJ,RPJ,,,,,false,,2013-08-18T12:00,,,,,,2013-08-18T12:30,,DHC-6 Twin Otter,N901ST,,,,,,,,,,,
2019-09-01,HAL,500,HNL,DFW,,,,,false,,2019-09-01T08:00,,,,,,,,Airbus A330,N9,,,,,,,g10,,,,,
2020-01-01,AAL,600,ZZZ,DFW,,,,,false,,2020-01-01T09:00,,,,,,,,Boeing 737,N10,,,,,,,g11,,,,,
2026-08-22,AAL,700,DFW,LAX,,,,,false,,2026-08-22T09:00,,,,,,,,Airbus A321,N11,,,,,,,g12,,,,,
```

- [ ] **Step 3: Write `src/test/engine/model.test.ts`** (the golden assertions)

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { buildModel, DEFAULT_SETTINGS } from '../../engine'
import type { Settings } from '../../engine/types'

const here = dirname(fileURLToPath(import.meta.url))
const csv = readFileSync(resolve(here, '../fixtures/golden.csv'), 'utf8')
const TODAY = '2026-06-25'
const S = (over: Partial<Settings> = {}): Settings => ({ ...DEFAULT_SETTINGS, ...over })

describe('golden model', () => {
  it('excludes the future row from flown stats', () => {
    const m = buildModel(csv, S(), TODAY)
    expect(m.all).toHaveLength(12)
    expect(m.flown.some((f) => f.date === '2026-08-22')).toBe(false)
  })
  it('excludes canceled by default', () => {
    const m = buildModel(csv, S(), TODAY)
    expect(m.flown.some((f) => f.canceled)).toBe(false)
  })
  it('surfaces the unknown ZZZ airport, not dropped', () => {
    const m = buildModel(csv, S(), TODAY)
    expect(m.unresolved.some((f) => f.fromCode === 'ZZZ')).toBe(true)
  })
  it('RPJ local flight: distance 0, ~20min, counts as a flight + airport touch, no route', () => {
    const m = buildModel(csv, S({ groupAirports: false }), TODAY)
    const rpj = m.flown.find((f) => f.fromCode === 'RPJ')!
    expect(rpj.distanceMi).toBe(0)
    expect(rpj.durationMin).toBe(20)
    expect(m.byAirport.find((a) => a.key === 'RPJ')!.count).toBe(1)
    expect(m.byRoute.some((r) => r.key.includes('RPJ'))).toBe(false)
  })
  it('§5.2: group on + unique off collapses the 3 Bay/Dallas legs to 1 route', () => {
    const m = buildModel(csv, S({ groupAirports: true, explicitlyUnique: false }), TODAY)
    const r = m.byRoute.filter((x) => x.key.includes('Dallas') && x.key.includes('SF Bay'))
    expect(r).toHaveLength(1)
    expect(r[0].count).toBe(3)
  })
  it('diverted row routes DFW->SPS', () => {
    const m = buildModel(csv, S({ groupAirports: false }), TODAY)
    expect(m.flown.find((f) => f.flightNumber === '301')!.toCode).toBe('SPS')
  })
})
```

- [ ] **Step 4: Run the golden test**

Run: `npm --prefix /Users/vijayram/Cursor/flight_visualizer test -- model`
Expected: PASS.

- [ ] **Step 5: Write `src/test/engine/realcsv.test.ts`** (smoke test against the real export — copy it in first)

Run first:
```bash
cp "/Users/vijayram/Cursor/lifecoach/ops/travel/reference/FlightyExport-2026-06-24.csv" /Users/vijayram/Cursor/flight_visualizer/src/test/fixtures/real-sample.csv
```

```ts
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { buildModel, DEFAULT_SETTINGS } from '../../engine'

const here = dirname(fileURLToPath(import.meta.url))
const path = resolve(here, '../fixtures/real-sample.csv')
const TODAY = '2026-06-25'

describe.skipIf(!existsSync(path))('real Flighty export smoke test', () => {
  const csv = readFileSync(path, 'utf8')
  const m = buildModel(csv, DEFAULT_SETTINGS, TODAY)

  it('parses ~1800 rows with a valid header', () => {
    expect(m.headerOk).toBe(true)
    expect(m.all.length).toBeGreaterThan(1700)
  })
  it('resolves essentially every airport (near-zero unknowns; RPJ resolves)', () => {
    const unknownCodes = new Set(m.unresolved.flatMap((f) => [f.fromCode, f.toCode]).filter((c) => {
      // only count codes that truly didn't resolve
      return m.all.some((x) => (x.fromCode === c && !x.from) || (x.toCode === c && !x.to))
    }))
    expect(unknownCodes.size).toBeLessThanOrEqual(2)
    expect(m.flown.some((f) => f.fromCode === 'RPJ' && f.durationMin === 20)).toBe(true)
  })
  it('produces no negative durations', () => {
    expect(m.flown.every((f) => f.durationMin === null || f.durationMin >= 0)).toBe(true)
  })
  it('Dallas is the top airport group', () => {
    expect(m.byAirport[0].key).toBe('Dallas')
  })
})
```

- [ ] **Step 6: Run the smoke test**

Run: `npm --prefix /Users/vijayram/Cursor/flight_visualizer test -- realcsv`
Expected: PASS. (If `real-sample.csv` is gitignored — see Step 7 — the suite still runs here because the file exists locally.)

- [ ] **Step 7: Gitignore the real sample (personal data) and run the full suite**

Append to `.gitignore`:
```
src/test/fixtures/real-sample.csv
```
Run: `npm --prefix /Users/vijayram/Cursor/flight_visualizer test`
Expected: ALL tests PASS.

- [ ] **Step 8: Commit**

```bash
git -C /Users/vijayram/Cursor/flight_visualizer add -A
git -C /Users/vijayram/Cursor/flight_visualizer commit -m "feat: buildModel public API + golden fixture + real-CSV smoke test"
```

---

## Phase 0 Acceptance

- [ ] `npm --prefix /Users/vijayram/Cursor/flight_visualizer run preprocess` regenerates all reference JSON and passes the size check (< 4 MB total).
- [ ] `npm --prefix /Users/vijayram/Cursor/flight_visualizer test` is green across all engine modules.
- [ ] The real export loads via `buildModel` with near-zero unresolved airports, RPJ resolving to a ~20-min local flight, no negative durations, and Dallas as the top group.
- [ ] No runtime network, no web workers, all reference data imported as ES modules.

This delivers the tested engine + reference layer that Plan 2 (Phase 1: app scaffold, settings/scope UI, and the first runnable cards) builds the UI on top of.
