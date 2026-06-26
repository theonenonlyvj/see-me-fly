# Flight Visualizer — Phase 1 Implementation Plan (App Shell + Settings/Scope + Core Cards)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the finished Phase-0 engine into a runnable, good-looking single-page app: drag-drop a Flighty CSV, pick a scope (all-time / year), toggle settings, and see the five core stat cards (Overview, Distance buckets, Airports, Airlines, Routes) recompute live. Builds to one self-contained `index.html`.

**Architecture:** A thin React shell over the pure engine (`buildModel`). State = settings (persisted in localStorage) + loaded CSV text + scope. A memoized `useModel` recomputes the engine model whenever `(csvText, settings, scope)` change. Cards are drop-in modules registered in a manifest; each is a thin renderer over `buildModel`'s output (no card re-derives data the engine already produces). Styling is plain CSS via design tokens (CSS custom properties, dark theme) — no Tailwind. Charts are hand-rolled SVG; the offline Map (Phase 3) will use bundled TopoJSON + D3.

**Tech Stack:** React 19 + TypeScript + Vite (already scaffolded in Phase 0). Vitest + @testing-library/react + jsdom for component tests (engine tests stay in node env). `vite-plugin-singlefile` for the single-file build (already a devDep). No new runtime deps.

## Global Constraints

_(Copied from the spec; every task implicitly includes these.)_

- **Local-only, no runtime network, no `fetch` at runtime.** CSV loads via the browser File API (drag-drop / picker); reference data is `import`ed (baked in). Works opened from `file://`.
- **No web workers.**
- **Single-file deliverable:** `npm run build` → one self-contained `dist/index.html` (vite-plugin-singlefile), `base: './'` so it works under `file://`.
- **Engine is the source of truth.** Cards consume `buildModel(csvText, settings, today, scopeYear?)` output; do not re-implement aggregation in components.
- **`today` is injected** (compute once at the app boundary via `new Date()` in App, pass the `YYYY-MM-DD` string down) — never call the clock inside the engine.
- **Settings persist** under a single namespaced localStorage key `flightviz:settings:v1` with `schemaVersion`, deep-merged over current defaults on load.
- **Defaults:** Group airports ON, Explicitly-unique OFF, Include-canceled OFF, Exclude-before OFF.
- **Phase 1 cards are display-only.** Click-through (airport popup → Flight Detail) is Phase 2 — do NOT build it here; lists show top-N + "show more" with no row click handler yet.
- **Aesthetic:** dark, modern, data-dense dashboard; all colors/spacing via CSS custom properties in `tokens.css` so the theme is retunable in one file.

## Engine API available (from Phase 0, do not modify)

`import { buildModel, DEFAULT_SETTINGS } from './engine'` (i.e. `src/engine/index.ts`). Also `import type { Settings, EnrichedFlight } from './engine'`.

- `DEFAULT_SETTINGS: Settings` = `{ groupAirports:true, explicitlyUnique:false, includeCanceled:false, excludeBeforeDate:null, duration: DEFAULT_DURATION_CONSTANTS }`.
- `buildModel(csvText, settings, today, scopeYear?)` → `{ headerOk:boolean, missingColumns:string[], all:EnrichedFlight[], flown:EnrichedFlight[], scoped:EnrichedFlight[], unresolved:EnrichedFlight[], years:number[], totals:{count,miles,minutes,uniqueAirports,airlines,uniqueRoutes}, byAirport:{key,count}[], byRoute:{key,count,miles}[], byAirline:{name,count}[], distanceBuckets:{label,count}[] }`.
- `Settings = { groupAirports:boolean, explicitlyUnique:boolean, includeCanceled:boolean, excludeBeforeDate:string|null, duration: DurationConstants }`.
- `groups` (the metro group list) and `airportToGroup` are exported from `./engine/reference` for the "view groupings" expander.

---

## File Structure

```
flight_visualizer/
  index.html                          # Vite entry, mounts #root
  src/
    main.tsx                          # ReactDOM mount
    App.tsx                           # loader-gate → dashboard; owns top-level state
    app/
      styles/tokens.css               # design tokens (CSS custom properties)
      styles/base.css                 # reset + base element styles
      state/settings-store.ts         # PURE: load/save/migrate settings in localStorage
      state/useSettings.ts            # React hook over settings-store
      state/useModel.ts               # memoized buildModel(csv, settings, today, scope)
      csv/load-csv.ts                 # PURE: validate parsed CSV; readFileText(File)
      lib/format.ts                   # PURE: number/distance/duration formatters
      components/Dropzone.tsx         # drag-drop + file picker + empty/welcome + error states
      components/TopBar.tsx           # title + ScopeDropdown + settings toggle
      components/ScopeDropdown.tsx
      components/SettingsPanel.tsx
      components/CardGrid.tsx
      components/CardFrame.tsx        # title + show-more + empty-state wrapper
      components/charts/BarList.tsx   # hand-rolled horizontal bar list (SVG-free, CSS bars)
      cards/registry.ts               # Card type + manifest (ordered list)
      cards/OverviewCard.tsx
      cards/DistanceCard.tsx
      cards/AirportsCard.tsx
      cards/AirlinesCard.tsx
      cards/RoutesCard.tsx
    test/app/*.test.ts(x)             # component/unit tests (jsdom for .tsx)
```

---

## Task 1: App scaffold + design tokens + single-file build

**Files:**
- Create: `index.html`, `src/main.tsx`, `src/App.tsx`, `src/app/styles/tokens.css`, `src/app/styles/base.css`
- Modify: `vite.config.ts` (add singlefile plugin + jsdom test setup), `package.json` (devDeps + test setup)
- Test: `src/test/app/smoke.test.tsx`

**Interfaces:**
- Produces: a mounting React app rendering a placeholder; `npm run build` emitting one self-contained `dist/index.html`; CSS custom-property tokens used by every later component.

- [ ] **Step 1: Add UI test deps**

Run:
```bash
npm --prefix /Users/vijayram/Cursor/flight_visualizer install -D @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```
Expected: installs without error.

- [ ] **Step 2: Update `vite.config.ts`** (singlefile build + keep node env default; .tsx tests opt into jsdom per-file)

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile()],
  test: {
    environment: 'node',
    include: ['src/test/**/*.test.ts', 'src/test/**/*.test.tsx'],
    setupFiles: ['src/test/setup.ts'],
  },
})
```

- [ ] **Step 3: Create `src/test/setup.ts`** (jest-dom matchers)

```ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 4: Create `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Flight Visualizer</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `src/app/styles/tokens.css`** (dark dashboard theme; retune here)

```css
:root {
  --bg: #0b0e14;
  --bg-elev: #141925;
  --bg-card: #161c28;
  --border: #232b3a;
  --text: #e6e9ef;
  --text-dim: #97a0b3;
  --accent: #5aa6ff;
  --accent-2: #36d399;
  --warn: #f5a524;
  --bar-track: #1c2433;
  --radius: 12px;
  --radius-sm: 8px;
  --gap: 16px;
  --pad: 16px;
  --font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  --mono: ui-monospace, SFMono-Regular, Menlo, monospace;
}
```

- [ ] **Step 6: Create `src/app/styles/base.css`**

```css
* { box-sizing: border-box; }
html, body, #root { height: 100%; margin: 0; }
body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font);
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}
button { font: inherit; color: inherit; cursor: pointer; }
a { color: var(--accent); }
```

- [ ] **Step 7: Create `src/App.tsx`** (placeholder shell — replaced incrementally)

```tsx
import './app/styles/tokens.css'
import './app/styles/base.css'

export default function App() {
  return (
    <div style={{ padding: 'var(--pad)' }}>
      <h1>Flight Visualizer</h1>
      <p style={{ color: 'var(--text-dim)' }}>Drop a Flighty CSV export to begin.</p>
    </div>
  )
}
```

- [ ] **Step 8: Create `src/main.tsx`**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 9: Write smoke test `src/test/app/smoke.test.tsx`**

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '../../App'

describe('App', () => {
  it('renders the welcome prompt', () => {
    render(<App />)
    expect(screen.getByText('Flight Visualizer')).toBeInTheDocument()
    expect(screen.getByText(/Drop a Flighty CSV/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 10: Run the smoke test**

Run: `npm --prefix /Users/vijayram/Cursor/flight_visualizer test -- smoke`
Expected: PASS.

- [ ] **Step 11: Verify the single-file build works**

Run: `npm --prefix /Users/vijayram/Cursor/flight_visualizer run build`
Expected: `tsc --noEmit` passes, then `vite build` emits `dist/index.html`. Confirm it's a single self-contained file (no `dist/assets/` JS chunks referenced):
```bash
ls -la /Users/vijayram/Cursor/flight_visualizer/dist/ && grep -c '<script' /Users/vijayram/Cursor/flight_visualizer/dist/index.html
```
Expected: `dist/index.html` exists; inlined script present. (Add `dist/` is already gitignored.)

- [ ] **Step 12: Run full suite + commit**

Run: `npm --prefix /Users/vijayram/Cursor/flight_visualizer test`
Expected: all pass (engine 75 + smoke 1).
```bash
git -C /Users/vijayram/Cursor/flight_visualizer add -A
git -C /Users/vijayram/Cursor/flight_visualizer commit -m "feat(app): scaffold React shell, design tokens, single-file build"
```

---

## Task 2: Settings store (localStorage, versioned, deep-merged)

**Files:**
- Create: `src/app/state/settings-store.ts`
- Test: `src/test/app/settings-store.test.ts`

**Interfaces:**
- Consumes: `DEFAULT_SETTINGS`, `Settings` from `../../engine`.
- Produces:
  - `SETTINGS_KEY = 'flightviz:settings:v1'`, `SCHEMA_VERSION = 1`.
  - `loadSettings(storage?: Storage): Settings` — deep-merges the stored blob over `DEFAULT_SETTINGS` (fills missing keys incl. nested `duration`); ignores a malformed blob; returns defaults if absent.
  - `saveSettings(s: Settings, storage?: Storage): void` — writes `{ schemaVersion, settings }`.
  - `resetSettings(storage?: Storage): void` — removes the key.

- [ ] **Step 1: Write the failing test `src/test/app/settings-store.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { loadSettings, saveSettings, resetSettings, SETTINGS_KEY } from '../../app/state/settings-store'
import { DEFAULT_SETTINGS } from '../../engine'

// minimal in-memory Storage
function mem(): Storage {
  const m = new Map<string, string>()
  return {
    get length() { return m.size },
    clear: () => m.clear(),
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, v),
  }
}

describe('settings-store', () => {
  let s: Storage
  beforeEach(() => { s = mem() })

  it('returns defaults when nothing stored', () => {
    expect(loadSettings(s)).toEqual(DEFAULT_SETTINGS)
  })

  it('round-trips saved settings', () => {
    const next = { ...DEFAULT_SETTINGS, groupAirports: false, excludeBeforeDate: '2001-01-01' }
    saveSettings(next, s)
    expect(loadSettings(s)).toEqual(next)
  })

  it('deep-merges partial/legacy blobs over current defaults', () => {
    s.setItem(SETTINGS_KEY, JSON.stringify({ schemaVersion: 1, settings: { explicitlyUnique: true } }))
    const loaded = loadSettings(s)
    expect(loaded.explicitlyUnique).toBe(true)
    expect(loaded.groupAirports).toBe(DEFAULT_SETTINGS.groupAirports) // filled
    expect(loaded.duration).toEqual(DEFAULT_SETTINGS.duration) // nested filled
  })

  it('ignores a malformed blob and returns defaults', () => {
    s.setItem(SETTINGS_KEY, 'not json{')
    expect(loadSettings(s)).toEqual(DEFAULT_SETTINGS)
  })

  it('reset removes the key', () => {
    saveSettings(DEFAULT_SETTINGS, s)
    resetSettings(s)
    expect(s.getItem(SETTINGS_KEY)).toBeNull()
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm --prefix /Users/vijayram/Cursor/flight_visualizer test -- settings-store`
Expected: FAIL (module not found).

- [ ] **Step 3: Write `src/app/state/settings-store.ts`**

```ts
import { DEFAULT_SETTINGS, type Settings } from '../../engine'

export const SETTINGS_KEY = 'flightviz:settings:v1'
export const SCHEMA_VERSION = 1

function safeStorage(storage?: Storage): Storage | null {
  if (storage) return storage
  try { return window.localStorage } catch { return null }
}

export function loadSettings(storage?: Storage): Settings {
  const s = safeStorage(storage)
  if (!s) return DEFAULT_SETTINGS
  const raw = s.getItem(SETTINGS_KEY)
  if (!raw) return DEFAULT_SETTINGS
  try {
    const parsed = JSON.parse(raw) as { schemaVersion?: number; settings?: Partial<Settings> }
    const stored = parsed?.settings ?? {}
    return {
      ...DEFAULT_SETTINGS,
      ...stored,
      duration: { ...DEFAULT_SETTINGS.duration, ...(stored.duration ?? {}) },
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings: Settings, storage?: Storage): void {
  const s = safeStorage(storage)
  if (!s) return
  s.setItem(SETTINGS_KEY, JSON.stringify({ schemaVersion: SCHEMA_VERSION, settings }))
}

export function resetSettings(storage?: Storage): void {
  const s = safeStorage(storage)
  if (!s) return
  s.removeItem(SETTINGS_KEY)
}
```

- [ ] **Step 4: Run the test**

Run: `npm --prefix /Users/vijayram/Cursor/flight_visualizer test -- settings-store`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git -C /Users/vijayram/Cursor/flight_visualizer add -A
git -C /Users/vijayram/Cursor/flight_visualizer commit -m "feat(app): versioned localStorage settings store"
```

---

## Task 3: Formatters + CSV load/validate (pure)

**Files:**
- Create: `src/app/lib/format.ts`, `src/app/csv/load-csv.ts`
- Test: `src/test/app/format.test.ts`, `src/test/app/load-csv.test.ts`

**Interfaces:**
- Produces (format.ts): `fmtInt(n)`, `fmtMiles(n)`, `fmtDuration(min)` (→ `"12h 30m"` / `"45m"`), `fmtCount(n, noun)`.
- Produces (load-csv.ts): `validateCsv(text): { ok: boolean; missingColumns: string[]; rowCount: number }` (wraps engine `parseFlightyCsv`); `readFileText(file: File): Promise<string>` (FileReader, no network).

- [ ] **Step 1: Write `src/test/app/format.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { fmtInt, fmtMiles, fmtDuration } from '../../app/lib/format'

describe('format', () => {
  it('fmtInt groups thousands', () => { expect(fmtInt(1418)).toBe('1,418') })
  it('fmtMiles appends unit', () => { expect(fmtMiles(802)).toBe('802 mi') })
  it('fmtDuration h+m', () => { expect(fmtDuration(780)).toBe('13h 0m') })
  it('fmtDuration sub-hour', () => { expect(fmtDuration(45)).toBe('45m') })
  it('fmtDuration null', () => { expect(fmtDuration(null)).toBe('—') })
})
```

- [ ] **Step 2: Write `src/test/app/load-csv.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { validateCsv } from '../../app/csv/load-csv'
import { REQUIRED_COLUMNS } from '../../engine/parse'

const HEADER = REQUIRED_COLUMNS.join(',')

describe('validateCsv', () => {
  it('accepts a valid Flighty header', () => {
    const csv = [HEADER, '2018-01-01,AAL,1,DFW,AUS,,,,,false,,2018-01-01T09:00,,,,,,,,Boeing 737,,,,,,,,,,,'].join('\n')
    const r = validateCsv(csv)
    expect(r.ok).toBe(true)
    expect(r.rowCount).toBe(1)
  })
  it('rejects a non-Flighty file', () => {
    const r = validateCsv('foo,bar\n1,2')
    expect(r.ok).toBe(false)
    expect(r.missingColumns).toContain('From')
  })
})
```

- [ ] **Step 3: Run both, confirm fail**

Run: `npm --prefix /Users/vijayram/Cursor/flight_visualizer test -- format load-csv`
Expected: FAIL (modules not found).

- [ ] **Step 4: Write `src/app/lib/format.ts`**

```ts
export function fmtInt(n: number): string {
  return Math.round(n).toLocaleString('en-US')
}
export function fmtMiles(n: number): string {
  return `${fmtInt(n)} mi`
}
export function fmtDuration(min: number | null): string {
  if (min === null || !Number.isFinite(min)) return '—'
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}
export function fmtCount(n: number, noun: string): string {
  return `${fmtInt(n)} ${noun}${n === 1 ? '' : 's'}`
}
```

- [ ] **Step 5: Write `src/app/csv/load-csv.ts`**

```ts
import { parseFlightyCsv } from '../../engine/parse'

export function validateCsv(text: string): { ok: boolean; missingColumns: string[]; rowCount: number } {
  const { rows, headerOk, missingColumns } = parseFlightyCsv(text)
  return { ok: headerOk, missingColumns, rowCount: rows.length }
}

export function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('File read failed'))
    reader.readAsText(file)
  })
}
```

- [ ] **Step 6: Run the tests**

Run: `npm --prefix /Users/vijayram/Cursor/flight_visualizer test -- format load-csv`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git -C /Users/vijayram/Cursor/flight_visualizer add -A
git -C /Users/vijayram/Cursor/flight_visualizer commit -m "feat(app): formatters + CSV validate/read helpers"
```

---

## Task 4: Dropzone + load flow + App state wiring (loader gate)

**Files:**
- Create: `src/app/components/Dropzone.tsx`
- Modify: `src/App.tsx`
- Test: `src/test/app/dropzone.test.tsx`

**Interfaces:**
- Consumes: `validateCsv`, `readFileText` (Task 3).
- Produces: `Dropzone({ onLoaded }: { onLoaded: (text: string, fileName: string) => void })` — renders the welcome/empty hero, a file `<input>` + drag-drop area; on a valid Flighty CSV calls `onLoaded`; on an invalid file shows a named error listing missing columns. App holds `csvText`/`fileName` state and renders Dropzone when no CSV is loaded, the dashboard when loaded (dashboard is a placeholder until Task 9+).

- [ ] **Step 1: Write `src/test/app/dropzone.test.tsx`**

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { REQUIRED_COLUMNS } from '../../engine/parse'
import Dropzone from '../../app/components/Dropzone'

const good = new File([[REQUIRED_COLUMNS.join(','), '2018-01-01,AAL,1,DFW,AUS,,,,,false,,2018-01-01T09:00,,,,,,,,Boeing 737,,,,,,,,,,,'].join('\n')], 'flighty.csv', { type: 'text/csv' })
const bad = new File(['foo,bar\n1,2'], 'nope.csv', { type: 'text/csv' })

describe('Dropzone', () => {
  it('shows the welcome prompt', () => {
    render(<Dropzone onLoaded={() => {}} />)
    expect(screen.getByText(/drop your flighty export/i)).toBeInTheDocument()
  })

  it('calls onLoaded for a valid Flighty CSV', async () => {
    const onLoaded = vi.fn()
    render(<Dropzone onLoaded={onLoaded} />)
    await userEvent.upload(screen.getByTestId('file-input'), good)
    expect(onLoaded).toHaveBeenCalledTimes(1)
    expect(onLoaded.mock.calls[0][1]).toBe('flighty.csv')
  })

  it('shows a named error for a non-Flighty CSV', async () => {
    const onLoaded = vi.fn()
    render(<Dropzone onLoaded={onLoaded} />)
    await userEvent.upload(screen.getByTestId('file-input'), bad)
    expect(onLoaded).not.toHaveBeenCalled()
    expect(await screen.findByText(/doesn't look like a Flighty export/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run it, confirm fail**

Run: `npm --prefix /Users/vijayram/Cursor/flight_visualizer test -- dropzone`
Expected: FAIL.

- [ ] **Step 3: Write `src/app/components/Dropzone.tsx`**

```tsx
import { useRef, useState } from 'react'
import { readFileText, validateCsv } from '../csv/load-csv'

export default function Dropzone({ onLoaded }: { onLoaded: (text: string, fileName: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  async function handleFile(file: File | undefined | null) {
    if (!file) return
    setError(null)
    const text = await readFileText(file)
    const { ok, missingColumns } = validateCsv(text)
    if (!ok) {
      setError(`"${file.name}" doesn't look like a Flighty export — missing columns: ${missingColumns.join(', ') || 'unknown'}.`)
      return
    }
    onLoaded(text, file.name)
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); void handleFile(e.dataTransfer.files?.[0]) }}
      style={{
        height: '100%', display: 'grid', placeItems: 'center', textAlign: 'center', padding: 'var(--pad)',
        border: dragging ? '2px dashed var(--accent)' : '2px dashed var(--border)',
        margin: 24, borderRadius: 'var(--radius)', background: 'var(--bg-elev)',
      }}
    >
      <div>
        <h1 style={{ marginBottom: 8 }}>✈️ Flight Visualizer</h1>
        <p style={{ color: 'var(--text-dim)', maxWidth: 420, margin: '0 auto 20px' }}>
          Drop your Flighty export here (the <code>FlightyExport-*.csv</code> file), or pick it. Everything stays on your machine.
        </p>
        <button
          onClick={() => inputRef.current?.click()}
          style={{ background: 'var(--accent)', color: '#06121f', border: 'none', borderRadius: 'var(--radius-sm)', padding: '10px 18px', fontWeight: 600 }}
        >
          Choose CSV…
        </button>
        <input
          ref={inputRef}
          data-testid="file-input"
          type="file"
          accept=".csv,text/csv"
          style={{ display: 'none' }}
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
        {error && <p role="alert" style={{ color: 'var(--warn)', marginTop: 16, maxWidth: 420 }}>{error}</p>}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Update `src/App.tsx` (loader gate; dashboard placeholder for now)**

```tsx
import { useState } from 'react'
import './app/styles/tokens.css'
import './app/styles/base.css'
import Dropzone from './app/components/Dropzone'

export default function App() {
  const [csv, setCsv] = useState<{ text: string; name: string } | null>(null)

  if (!csv) return <Dropzone onLoaded={(text, name) => setCsv({ text, name })} />

  return (
    <div style={{ padding: 'var(--pad)' }}>
      <p style={{ color: 'var(--text-dim)' }}>Loaded {csv.name}. Dashboard coming online…</p>
    </div>
  )
}
```

- [ ] **Step 5: Run the test + smoke**

Run: `npm --prefix /Users/vijayram/Cursor/flight_visualizer test -- dropzone smoke`
Expected: dropzone 3/3 PASS. (smoke.test.tsx still asserts the old App copy — UPDATE it: replace its assertions with `expect(screen.getByText(/Flight Visualizer/i)).toBeInTheDocument()` and `expect(screen.getByText(/drop your flighty export/i)).toBeInTheDocument()`, since App now renders Dropzone. Re-run smoke to confirm PASS.)

- [ ] **Step 6: Commit**

```bash
git -C /Users/vijayram/Cursor/flight_visualizer add -A
git -C /Users/vijayram/Cursor/flight_visualizer commit -m "feat(app): CSV dropzone + loader gate with header validation"
```

---

## Task 5: useSettings + useModel hooks

**Files:**
- Create: `src/app/state/useSettings.ts`, `src/app/state/useModel.ts`
- Test: `src/test/app/hooks.test.tsx`

**Interfaces:**
- Consumes: `loadSettings`/`saveSettings` (Task 2), `buildModel` (engine).
- Produces:
  - `useSettings(): [Settings, (patch: Partial<Settings>) => void, () => void]` — `[settings, update, reset]`; `update` shallow-merges a patch (deep-merges `duration`), persists via `saveSettings`; `reset` restores defaults + clears storage.
  - `useModel(csvText: string | null, settings: Settings, today: string, scopeYear?: number)` — returns `buildModel(...)` memoized on `(csvText, settings, scopeYear)`; returns `null` when `csvText` is null.

- [ ] **Step 1: Write `src/test/app/hooks.test.tsx`**

```tsx
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSettings } from '../../app/state/useSettings'
import { useModel } from '../../app/state/useModel'
import { DEFAULT_SETTINGS } from '../../engine'
import { REQUIRED_COLUMNS } from '../../engine/parse'

const csv = [REQUIRED_COLUMNS.join(','), '2018-01-01,AAL,1,DFW,AUS,,,,,false,,2018-01-01T09:00,,,,,,,,Boeing 737,,,,,,,,,,,'].join('\n')

describe('useSettings', () => {
  beforeEach(() => localStorage.clear())
  it('starts at defaults and updates + persists', () => {
    const { result } = renderHook(() => useSettings())
    expect(result.current[0]).toEqual(DEFAULT_SETTINGS)
    act(() => result.current[1]({ groupAirports: false }))
    expect(result.current[0].groupAirports).toBe(false)
    expect(JSON.parse(localStorage.getItem('flightviz:settings:v1')!).settings.groupAirports).toBe(false)
  })
})

describe('useModel', () => {
  it('returns null without csv, a model with csv', () => {
    const { result, rerender } = renderHook(({ t }: { t: string | null }) => useModel(t, DEFAULT_SETTINGS, '2026-06-25'), { initialProps: { t: null as string | null } })
    expect(result.current).toBeNull()
    rerender({ t: csv })
    expect(result.current!.totals.count).toBe(1)
  })
})
```

- [ ] **Step 2: Run it, confirm fail**

Run: `npm --prefix /Users/vijayram/Cursor/flight_visualizer test -- hooks`
Expected: FAIL.

- [ ] **Step 3: Write `src/app/state/useSettings.ts`**

```ts
import { useCallback, useState } from 'react'
import { loadSettings, saveSettings, resetSettings } from './settings-store'
import { DEFAULT_SETTINGS, type Settings } from '../../engine'

export function useSettings(): [Settings, (patch: Partial<Settings>) => void, () => void] {
  const [settings, setSettings] = useState<Settings>(() => loadSettings())

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next: Settings = {
        ...prev,
        ...patch,
        duration: { ...prev.duration, ...(patch.duration ?? {}) },
      }
      saveSettings(next)
      return next
    })
  }, [])

  const reset = useCallback(() => {
    resetSettings()
    setSettings(DEFAULT_SETTINGS)
  }, [])

  return [settings, update, reset]
}
```

- [ ] **Step 4: Write `src/app/state/useModel.ts`**

```ts
import { useMemo } from 'react'
import { buildModel, type Settings } from '../../engine'

export type Model = ReturnType<typeof buildModel>

export function useModel(csvText: string | null, settings: Settings, today: string, scopeYear?: number): Model | null {
  return useMemo(() => {
    if (csvText === null) return null
    return buildModel(csvText, settings, today, scopeYear)
  }, [csvText, settings, today, scopeYear])
}
```

- [ ] **Step 5: Run the test**

Run: `npm --prefix /Users/vijayram/Cursor/flight_visualizer test -- hooks`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git -C /Users/vijayram/Cursor/flight_visualizer add -A
git -C /Users/vijayram/Cursor/flight_visualizer commit -m "feat(app): useSettings + memoized useModel hooks"
```

---

## Task 6: Card registry + CardFrame + BarList chart

**Files:**
- Create: `src/app/cards/registry.ts`, `src/app/components/CardFrame.tsx`, `src/app/components/charts/BarList.tsx`
- Test: `src/test/app/card-frame.test.tsx`, `src/test/app/bar-list.test.tsx`

**Interfaces:**
- Consumes: `Model` (Task 5), `Settings`.
- Produces:
  - `CardContext = { model: Model; settings: Settings }` and `CardDef = { id: string; title: string; group: 'core' | 'creative'; render: (ctx: CardContext) => ReactNode }`. `CARDS: CardDef[]` (manifest; populated as cards land — starts empty/with cards added in later tasks).
  - `CardFrame({ title, children, footer })` — titled card container; `BarList({ rows, max?, formatValue? })` rows `{label, value}[]` → CSS horizontal bars + a "Show more"/"Show less" toggle when `> max` (default 10).

- [ ] **Step 1: Write `src/test/app/bar-list.test.tsx`**

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BarList from '../../app/components/charts/BarList'

const rows = Array.from({ length: 14 }, (_, i) => ({ label: `R${i}`, value: 14 - i }))

describe('BarList', () => {
  it('caps at max and reveals the rest on show more', async () => {
    render(<BarList rows={rows} max={10} />)
    expect(screen.getByText('R0')).toBeInTheDocument()
    expect(screen.queryByText('R12')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /show more/i }))
    expect(screen.getByText('R12')).toBeInTheDocument()
  })
  it('no toggle when within max', () => {
    render(<BarList rows={rows.slice(0, 5)} max={10} />)
    expect(screen.queryByRole('button', { name: /show more/i })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Write `src/test/app/card-frame.test.tsx`**

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import CardFrame from '../../app/components/CardFrame'

describe('CardFrame', () => {
  it('renders title + children', () => {
    render(<CardFrame title="Overview">hi</CardFrame>)
    expect(screen.getByRole('heading', { name: 'Overview' })).toBeInTheDocument()
    expect(screen.getByText('hi')).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run both, confirm fail**

Run: `npm --prefix /Users/vijayram/Cursor/flight_visualizer test -- bar-list card-frame`
Expected: FAIL.

- [ ] **Step 4: Write `src/app/components/CardFrame.tsx`**

```tsx
import type { ReactNode } from 'react'

export default function CardFrame({ title, children, footer }: { title: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <section style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 'var(--pad)' }}>
      <h2 style={{ margin: '0 0 12px', fontSize: 15, color: 'var(--text-dim)', fontWeight: 600, letterSpacing: 0.2 }}>{title}</h2>
      {children}
      {footer && <div style={{ marginTop: 12 }}>{footer}</div>}
    </section>
  )
}
```

- [ ] **Step 5: Write `src/app/components/charts/BarList.tsx`**

```tsx
import { useState } from 'react'

export interface BarRow { label: string; value: number; sub?: string }

export default function BarList({ rows, max = 10, formatValue = (n: number) => n.toLocaleString('en-US') }: {
  rows: BarRow[]; max?: number; formatValue?: (n: number) => string
}) {
  const [expanded, setExpanded] = useState(false)
  if (rows.length === 0) return <p style={{ color: 'var(--text-dim)' }}>No data for this view.</p>
  const peak = Math.max(...rows.map((r) => r.value), 1)
  const shown = expanded ? rows : rows.slice(0, max)
  return (
    <div>
      <div style={{ display: 'grid', gap: 6 }}>
        {shown.map((r) => (
          <div key={r.label} style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 8 }}>
            <div style={{ position: 'relative', background: 'var(--bar-track)', borderRadius: 6, height: 24, overflow: 'hidden' }}>
              <div style={{ position: 'absolute', inset: 0, width: `${(r.value / peak) * 100}%`, background: 'var(--accent)', opacity: 0.35 }} />
              <span style={{ position: 'relative', padding: '0 8px', lineHeight: '24px', whiteSpace: 'nowrap' }}>{r.label}{r.sub && <span style={{ color: 'var(--text-dim)' }}> · {r.sub}</span>}</span>
            </div>
            <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text)' }}>{formatValue(r.value)}</span>
          </div>
        ))}
      </div>
      {rows.length > max && (
        <button onClick={() => setExpanded((v) => !v)} style={{ marginTop: 10, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-dim)', borderRadius: 'var(--radius-sm)', padding: '4px 10px' }}>
          {expanded ? 'Show less' : `Show more (${rows.length - max})`}
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Write `src/app/cards/registry.ts`**

```ts
import type { ReactNode } from 'react'
import type { Model } from '../state/useModel'
import type { Settings } from '../../engine'

export interface CardContext { model: Model; settings: Settings }
export interface CardDef { id: string; title: string; group: 'core' | 'creative'; render: (ctx: CardContext) => ReactNode }

// Cards are appended here as they are implemented (Tasks 7-12 etc.).
export const CARDS: CardDef[] = []
```

- [ ] **Step 7: Run the tests**

Run: `npm --prefix /Users/vijayram/Cursor/flight_visualizer test -- bar-list card-frame`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git -C /Users/vijayram/Cursor/flight_visualizer add -A
git -C /Users/vijayram/Cursor/flight_visualizer commit -m "feat(app): card registry + CardFrame + BarList chart"
```

---

## Task 7: Overview card

**Files:**
- Create: `src/app/cards/OverviewCard.tsx`
- Modify: `src/app/cards/registry.ts` (register)
- Test: `src/test/app/overview-card.test.tsx`

**Interfaces:**
- Consumes: `CardContext`, `CardFrame`, `fmtInt`/`fmtMiles`/`fmtDuration`, `Model.totals`.
- Produces: `overviewCard: CardDef` (id `'overview'`), a stat grid of: flights, total distance, time in flight, unique airports, airlines, unique routes.

- [ ] **Step 1: Write `src/test/app/overview-card.test.tsx`**

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { overviewCard } from '../../app/cards/OverviewCard'
import { buildModel, DEFAULT_SETTINGS } from '../../engine'
import { REQUIRED_COLUMNS } from '../../engine/parse'

const csv = [REQUIRED_COLUMNS.join(','),
  '2018-01-01,AAL,1,DFW,AUS,,,,,false,,2018-01-01T09:00,,,,,,,,Boeing 737,,,,,,,,,,,',
  '2018-02-01,UAL,2,DFW,SFO,,,,,false,,2018-02-01T09:00,,,,,,,,Boeing 737,,,,,,,,,,,',
].join('\n')

describe('overviewCard', () => {
  it('renders the flight count', () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    render(<>{overviewCard.render({ model, settings: DEFAULT_SETTINGS })}</>)
    expect(screen.getByText('Flights')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run it, confirm fail**

Run: `npm --prefix /Users/vijayram/Cursor/flight_visualizer test -- overview-card`
Expected: FAIL.

- [ ] **Step 3: Write `src/app/cards/OverviewCard.tsx`**

```tsx
import CardFrame from '../components/CardFrame'
import { fmtInt, fmtMiles, fmtDuration } from '../lib/format'
import type { CardContext, CardDef } from './registry'

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>{label}</div>
    </div>
  )
}

export const overviewCard: CardDef = {
  id: 'overview',
  title: 'Overview',
  group: 'core',
  render: ({ model }: CardContext) => {
    const t = model!.totals
    return (
      <CardFrame title="Overview">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--gap)' }}>
          <Stat label="Flights" value={fmtInt(t.count)} />
          <Stat label="Distance" value={fmtMiles(t.miles)} />
          <Stat label="Time in flight" value={fmtDuration(t.minutes)} />
          <Stat label="Unique airports" value={fmtInt(t.uniqueAirports)} />
          <Stat label="Airlines" value={fmtInt(t.airlines)} />
          <Stat label="Unique routes" value={fmtInt(t.uniqueRoutes)} />
        </div>
      </CardFrame>
    )
  },
}
```

- [ ] **Step 4: Register in `src/app/cards/registry.ts`**

Change the `CARDS` line to import + include it:
```ts
import { overviewCard } from './OverviewCard'
export const CARDS: CardDef[] = [overviewCard]
```
(Add the import at the top with the others.)

- [ ] **Step 5: Run the test**

Run: `npm --prefix /Users/vijayram/Cursor/flight_visualizer test -- overview-card`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git -C /Users/vijayram/Cursor/flight_visualizer add -A
git -C /Users/vijayram/Cursor/flight_visualizer commit -m "feat(card): Overview"
```

---

## Task 8: Distance buckets card

**Files:**
- Create: `src/app/cards/DistanceCard.tsx`
- Modify: `src/app/cards/registry.ts`
- Test: `src/test/app/distance-card.test.tsx`

**Interfaces:**
- Consumes: `Model.distanceBuckets` (`{label,count}[]`), `BarList`, `CardFrame`.
- Produces: `distanceCard: CardDef` (id `'distance'`) — a BarList of the buckets (order preserved, not sorted — buckets are ordered bands).

- [ ] **Step 1: Write `src/test/app/distance-card.test.tsx`**

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { distanceCard } from '../../app/cards/DistanceCard'
import { buildModel, DEFAULT_SETTINGS } from '../../engine'
import { REQUIRED_COLUMNS } from '../../engine/parse'

const csv = [REQUIRED_COLUMNS.join(','),
  '2018-01-01,AAL,1,DFW,AUS,,,,,false,,2018-01-01T09:00,,,,,,,,Boeing 737,,,,,,,,,,,', // ~190mi <300
  '2018-02-01,AAL,2,DFW,LHR,,,,,false,,2018-02-01T09:00,,,,,,,,Boeing 777,,,,,,,,,,,', // ~4700mi
].join('\n')

describe('distanceCard', () => {
  it('renders the <300 band with a count', () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    render(<>{distanceCard.render({ model, settings: DEFAULT_SETTINGS })}</>)
    expect(screen.getByText(/<300 mi/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run it, confirm fail**

Run: `npm --prefix /Users/vijayram/Cursor/flight_visualizer test -- distance-card`
Expected: FAIL.

- [ ] **Step 3: Write `src/app/cards/DistanceCard.tsx`**

```tsx
import CardFrame from '../components/CardFrame'
import BarList from '../components/charts/BarList'
import type { CardContext, CardDef } from './registry'

export const distanceCard: CardDef = {
  id: 'distance',
  title: 'Distance buckets',
  group: 'core',
  render: ({ model }: CardContext) => {
    const rows = model!.distanceBuckets.map((b) => ({ label: b.label, value: b.count }))
    return (
      <CardFrame title="How far">
        <BarList rows={rows} max={rows.length} formatValue={(n) => `${n}`} />
      </CardFrame>
    )
  },
}
```

- [ ] **Step 4: Register** (add `import { distanceCard } from './DistanceCard'` and append `distanceCard` to `CARDS`).

- [ ] **Step 5: Run the test**

Run: `npm --prefix /Users/vijayram/Cursor/flight_visualizer test -- distance-card`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git -C /Users/vijayram/Cursor/flight_visualizer add -A
git -C /Users/vijayram/Cursor/flight_visualizer commit -m "feat(card): Distance buckets"
```

---

## Task 9: Airports card

**Files:**
- Create: `src/app/cards/AirportsCard.tsx`
- Modify: `src/app/cards/registry.ts`
- Test: `src/test/app/airports-card.test.tsx`

**Interfaces:**
- Consumes: `Model.byAirport` (`{key,count}[]`, already sorted desc), `BarList`, `CardFrame`.
- Produces: `airportsCard: CardDef` (id `'airports'`) — top-10 + show-more BarList. (Display only — no click-through; that's Phase 2.)

- [ ] **Step 1: Write `src/test/app/airports-card.test.tsx`**

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { airportsCard } from '../../app/cards/AirportsCard'
import { buildModel, DEFAULT_SETTINGS } from '../../engine'
import { REQUIRED_COLUMNS } from '../../engine/parse'

const csv = [REQUIRED_COLUMNS.join(','),
  '2018-01-01,AAL,1,DFW,AUS,,,,,false,,2018-01-01T09:00,,,,,,,,Boeing 737,,,,,,,,,,,',
  '2018-02-01,AAL,2,DAL,AUS,,,,,false,,2018-02-01T09:00,,,,,,,,Boeing 737,,,,,,,,,,,',
].join('\n')

describe('airportsCard', () => {
  it('shows Dallas group as a top airport when grouping is on', () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    render(<>{airportsCard.render({ model, settings: DEFAULT_SETTINGS })}</>)
    expect(screen.getByText('Dallas')).toBeInTheDocument()
    expect(screen.getByText('AUS')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run it, confirm fail**

Run: `npm --prefix /Users/vijayram/Cursor/flight_visualizer test -- airports-card`
Expected: FAIL.

- [ ] **Step 3: Write `src/app/cards/AirportsCard.tsx`**

```tsx
import CardFrame from '../components/CardFrame'
import BarList from '../components/charts/BarList'
import type { CardContext, CardDef } from './registry'

export const airportsCard: CardDef = {
  id: 'airports',
  title: 'Airports',
  group: 'core',
  render: ({ model }: CardContext) => {
    const rows = model!.byAirport.map((a) => ({ label: a.key, value: a.count }))
    return (
      <CardFrame title="Most-visited airports">
        <BarList rows={rows} max={10} formatValue={(n) => `${n}`} />
      </CardFrame>
    )
  },
}
```

- [ ] **Step 4: Register** (`import { airportsCard } from './AirportsCard'`, append to `CARDS`).

- [ ] **Step 5: Run the test**

Run: `npm --prefix /Users/vijayram/Cursor/flight_visualizer test -- airports-card`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git -C /Users/vijayram/Cursor/flight_visualizer add -A
git -C /Users/vijayram/Cursor/flight_visualizer commit -m "feat(card): Airports"
```

---

## Task 10: Airlines card

**Files:**
- Create: `src/app/cards/AirlinesCard.tsx`
- Modify: `src/app/cards/registry.ts`
- Test: `src/test/app/airlines-card.test.tsx`

**Interfaces:**
- Consumes: `Model.byAirline` (`{name,count}[]`, sorted desc, excludes "Unknown airline"), `BarList`, `CardFrame`.
- Produces: `airlinesCard: CardDef` (id `'airlines'`) — top-5 + show-more.

- [ ] **Step 1: Write `src/test/app/airlines-card.test.tsx`**

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { airlinesCard } from '../../app/cards/AirlinesCard'
import { buildModel, DEFAULT_SETTINGS } from '../../engine'
import { REQUIRED_COLUMNS } from '../../engine/parse'

const csv = [REQUIRED_COLUMNS.join(','),
  '2018-01-01,AAL,1,DFW,AUS,,,,,false,,2018-01-01T09:00,,,,,,,,Boeing 737,,,,,,,,,,,',
].join('\n')

describe('airlinesCard', () => {
  it('shows a resolved airline name', () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    render(<>{airlinesCard.render({ model, settings: DEFAULT_SETTINGS })}</>)
    expect(screen.getByText(/American/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run it, confirm fail**

Run: `npm --prefix /Users/vijayram/Cursor/flight_visualizer test -- airlines-card`
Expected: FAIL.

- [ ] **Step 3: Write `src/app/cards/AirlinesCard.tsx`**

```tsx
import CardFrame from '../components/CardFrame'
import BarList from '../components/charts/BarList'
import type { CardContext, CardDef } from './registry'

export const airlinesCard: CardDef = {
  id: 'airlines',
  title: 'Airlines',
  group: 'core',
  render: ({ model }: CardContext) => {
    const rows = model!.byAirline.map((a) => ({ label: a.name, value: a.count }))
    return (
      <CardFrame title="Airlines flown">
        <BarList rows={rows} max={5} formatValue={(n) => `${n}`} />
      </CardFrame>
    )
  },
}
```

- [ ] **Step 4: Register** (`import { airlinesCard } from './AirlinesCard'`, append to `CARDS`).

- [ ] **Step 5: Run the test**

Run: `npm --prefix /Users/vijayram/Cursor/flight_visualizer test -- airlines-card`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git -C /Users/vijayram/Cursor/flight_visualizer add -A
git -C /Users/vijayram/Cursor/flight_visualizer commit -m "feat(card): Airlines"
```

---

## Task 11: Routes card (toggle miles / #flights)

**Files:**
- Create: `src/app/cards/RoutesCard.tsx`
- Modify: `src/app/cards/registry.ts`
- Test: `src/test/app/routes-card.test.tsx`

**Interfaces:**
- Consumes: `Model.byRoute` (`{key,count,miles}[]`, sorted by count desc), `BarList`, `CardFrame`, React `useState` for the toggle.
- Produces: `routesCard: CardDef` (id `'routes'`) — top-10 + show-more; a toggle switches the metric between `# flights` (count) and `miles` (re-sorted desc by the chosen metric).

- [ ] **Step 1: Write `src/test/app/routes-card.test.tsx`**

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { routesCard } from '../../app/cards/RoutesCard'
import { buildModel, DEFAULT_SETTINGS } from '../../engine'
import { REQUIRED_COLUMNS } from '../../engine/parse'

const csv = [REQUIRED_COLUMNS.join(','),
  '2018-01-01,AAL,1,DFW,AUS,,,,,false,,2018-01-01T09:00,,,,,,,,Boeing 737,,,,,,,,,,,',
  '2018-02-01,AAL,2,DFW,LHR,,,,,false,,2018-02-01T09:00,,,,,,,,Boeing 777,,,,,,,,,,,',
].join('\n')

describe('routesCard', () => {
  it('renders routes and supports the metric toggle', async () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    render(<>{routesCard.render({ model, settings: DEFAULT_SETTINGS })}</>)
    // a route label uses the ↔ undirected separator under default settings
    expect(screen.getByText(/↔/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /miles/i }))
    expect(screen.getByRole('button', { name: /miles/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run it, confirm fail**

Run: `npm --prefix /Users/vijayram/Cursor/flight_visualizer test -- routes-card`
Expected: FAIL.

- [ ] **Step 3: Write `src/app/cards/RoutesCard.tsx`**

```tsx
import { useState } from 'react'
import CardFrame from '../components/CardFrame'
import BarList from '../components/charts/BarList'
import { fmtInt, fmtMiles } from '../lib/format'
import type { CardContext, CardDef } from './registry'

function Routes({ model }: CardContext) {
  const [metric, setMetric] = useState<'count' | 'miles'>('count')
  const rows = [...model!.byRoute]
    .sort((a, b) => (metric === 'count' ? b.count - a.count : b.miles - a.miles))
    .map((r) => ({ label: r.key, value: metric === 'count' ? r.count : Math.round(r.miles) }))
  const toggle = (
    <div style={{ display: 'inline-flex', gap: 4 }}>
      {(['count', 'miles'] as const).map((m) => (
        <button key={m} onClick={() => setMetric(m)}
          style={{ background: metric === m ? 'var(--accent)' : 'transparent', color: metric === m ? '#06121f' : 'var(--text-dim)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '2px 10px' }}>
          {m === 'count' ? '# flights' : 'miles'}
        </button>
      ))}
    </div>
  )
  return (
    <CardFrame title="Top routes" footer={toggle}>
      <BarList rows={rows} max={10} formatValue={(n) => (metric === 'count' ? fmtInt(n) : fmtMiles(n))} />
    </CardFrame>
  )
}

export const routesCard: CardDef = {
  id: 'routes',
  title: 'Routes',
  group: 'core',
  render: (ctx: CardContext) => <Routes {...ctx} />,
}
```

- [ ] **Step 4: Register** (`import { routesCard } from './RoutesCard'`, append to `CARDS`).

- [ ] **Step 5: Run the test**

Run: `npm --prefix /Users/vijayram/Cursor/flight_visualizer test -- routes-card`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git -C /Users/vijayram/Cursor/flight_visualizer add -A
git -C /Users/vijayram/Cursor/flight_visualizer commit -m "feat(card): Routes with miles/#flights toggle"
```

---

## Task 12: TopBar + ScopeDropdown + SettingsPanel + CardGrid + final wiring

**Files:**
- Create: `src/app/components/TopBar.tsx`, `src/app/components/ScopeDropdown.tsx`, `src/app/components/SettingsPanel.tsx`, `src/app/components/CardGrid.tsx`
- Modify: `src/App.tsx` (assemble the dashboard)
- Test: `src/test/app/dashboard.test.tsx`

**Interfaces:**
- Consumes: `useSettings`, `useModel`, `CARDS`, `groups`/`airportToGroup` from `../../engine/reference`.
- Produces: a full dashboard — TopBar (title + scope dropdown + settings toggle), SettingsPanel (the 4 booleans + view-groupings expander + advanced duration constants + reset + replace-file), CardGrid (renders every `CARDS` entry through its `render(ctx)`). `ScopeDropdown` lists "All-time" + `model.years` (descending) and reports the selected year (or undefined). Changing scope/settings recomputes via `useModel`.

- [ ] **Step 1: Write `src/test/app/dashboard.test.tsx`**

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Dashboard from '../../app/components/CardGrid'
import { buildModel, DEFAULT_SETTINGS } from '../../engine'
import { REQUIRED_COLUMNS } from '../../engine/parse'

const csv = [REQUIRED_COLUMNS.join(','),
  '2018-01-01,AAL,1,DFW,AUS,,,,,false,,2018-01-01T09:00,,,,,,,,Boeing 737,,,,,,,,,,,',
].join('\n')

describe('CardGrid', () => {
  it('renders all registered cards', () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    render(<Dashboard model={model} settings={DEFAULT_SETTINGS} />)
    expect(screen.getByRole('heading', { name: 'Overview' })).toBeInTheDocument()
    expect(screen.getByText(/Most-visited airports/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run it, confirm fail**

Run: `npm --prefix /Users/vijayram/Cursor/flight_visualizer test -- dashboard`
Expected: FAIL.

- [ ] **Step 3: Write `src/app/components/CardGrid.tsx`**

```tsx
import { CARDS } from '../cards/registry'
import type { Model } from '../state/useModel'
import type { Settings } from '../../engine'

export default function CardGrid({ model, settings }: { model: Model; settings: Settings }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--gap)', padding: 'var(--pad)' }}>
      {CARDS.map((c) => (
        <div key={c.id}>{c.render({ model, settings })}</div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Write `src/app/components/ScopeDropdown.tsx`**

```tsx
export default function ScopeDropdown({ years, value, onChange }: { years: number[]; value: number | undefined; onChange: (y: number | undefined) => void }) {
  return (
    <select
      value={value ?? 'all'}
      onChange={(e) => onChange(e.target.value === 'all' ? undefined : Number(e.target.value))}
      style={{ background: 'var(--bg-elev)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '6px 10px' }}
    >
      <option value="all">All-time</option>
      {[...years].sort((a, b) => b - a).map((y) => <option key={y} value={y}>{y}</option>)}
    </select>
  )
}
```

- [ ] **Step 5: Write `src/app/components/SettingsPanel.tsx`**

```tsx
import { useState } from 'react'
import { groups, airportToGroup } from '../../engine/reference'
import type { Settings, EnrichedFlight } from '../../engine'

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}

export default function SettingsPanel({ settings, update, reset, onReplace, flown }: {
  settings: Settings
  update: (patch: Partial<Settings>) => void
  reset: () => void
  onReplace: () => void
  flown: EnrichedFlight[]
}) {
  const [showGroups, setShowGroups] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // active groups = those with >=1 member airport present in the loaded+filtered set
  const present = new Set<string>()
  for (const f of flown) { if (f.fromCode) present.add(f.fromCode); if (f.toCode) present.add(f.toCode) }
  const activeGroups = groups.filter((g) => g.airports.some((a) => present.has(a)))

  return (
    <div style={{ background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 'var(--pad)', display: 'grid', gap: 12 }}>
      <Toggle label="Group nearby airports into metros" checked={settings.groupAirports} onChange={(v) => update({ groupAirports: v })} />
      {settings.groupAirports && (
        <button onClick={() => setShowGroups((v) => !v)} style={{ justifySelf: 'start', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-dim)', borderRadius: 'var(--radius-sm)', padding: '3px 10px' }}>
          {showGroups ? 'Hide groupings' : `View groupings (${activeGroups.length} active)`}
        </button>
      )}
      {showGroups && (
        <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--text-dim)', fontSize: 13 }}>
          {activeGroups.map((g) => <li key={g.name}><strong style={{ color: 'var(--text)' }}>{g.name}</strong>: {g.airports.filter((a) => present.has(a)).join(', ')}</li>)}
        </ul>
      )}
      <Toggle label="Treat A→B and B→A as different routes (explicitly unique)" checked={settings.explicitlyUnique} onChange={(v) => update({ explicitlyUnique: v })} />
      <Toggle label="Include canceled flights" checked={settings.includeCanceled} onChange={(v) => update({ includeCanceled: v })} />
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input type="checkbox" checked={settings.excludeBeforeDate !== null} onChange={(e) => update({ excludeBeforeDate: e.target.checked ? '2001-01-01' : null })} />
        Exclude flights before
        <input type="date" disabled={settings.excludeBeforeDate === null} value={settings.excludeBeforeDate ?? ''} onChange={(e) => update({ excludeBeforeDate: e.target.value || null })}
          style={{ background: 'var(--bg-card)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 6px' }} />
      </label>

      <button onClick={() => setShowAdvanced((v) => !v)} style={{ justifySelf: 'start', background: 'transparent', border: 'none', color: 'var(--text-dim)', padding: 0, textDecoration: 'underline' }}>
        {showAdvanced ? 'Hide advanced' : 'Advanced (duration estimate)'}
      </button>
      {showAdvanced && (
        <div style={{ display: 'grid', gap: 6, fontSize: 13 }}>
          {([['cruiseMph', 'Cruise mph'], ['taxiMin', 'Taxi min'], ['climbDescentMin', 'Climb/descent min'], ['gateTaxiMin', 'Gate taxi min'], ['localFlightDefaultMin', 'Local-flight default min']] as const).map(([key, label]) => (
            <label key={key} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              {label}
              <input type="number" value={settings.duration[key]} onChange={(e) => update({ duration: { ...settings.duration, [key]: Number(e.target.value) } })}
                style={{ width: 80, background: 'var(--bg-card)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 6px' }} />
            </label>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button onClick={reset} style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-dim)', borderRadius: 'var(--radius-sm)', padding: '4px 10px' }}>Reset settings</button>
        <button onClick={onReplace} style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-dim)', borderRadius: 'var(--radius-sm)', padding: '4px 10px' }}>Load a different CSV</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Write `src/app/components/TopBar.tsx`**

```tsx
import ScopeDropdown from './ScopeDropdown'

export default function TopBar({ fileName, years, scope, onScope, onToggleSettings }: {
  fileName: string; years: number[]; scope: number | undefined; onScope: (y: number | undefined) => void; onToggleSettings: () => void
}) {
  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 5, display: 'flex', alignItems: 'center', gap: 12, padding: '10px var(--pad)', background: 'var(--bg-elev)', borderBottom: '1px solid var(--border)' }}>
      <strong style={{ fontSize: 16 }}>✈️ Flight Visualizer</strong>
      <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>{fileName}</span>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
        <ScopeDropdown years={years} value={scope} onChange={onScope} />
        <button onClick={onToggleSettings} style={{ background: 'var(--bg-card)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '6px 12px' }}>⚙ Settings</button>
      </div>
    </header>
  )
}
```

- [ ] **Step 7: Assemble `src/App.tsx`**

```tsx
import { useMemo, useState } from 'react'
import './app/styles/tokens.css'
import './app/styles/base.css'
import Dropzone from './app/components/Dropzone'
import TopBar from './app/components/TopBar'
import SettingsPanel from './app/components/SettingsPanel'
import CardGrid from './app/components/CardGrid'
import { useSettings } from './app/state/useSettings'
import { useModel } from './app/state/useModel'

export default function App() {
  const [csv, setCsv] = useState<{ text: string; name: string } | null>(null)
  const [scope, setScope] = useState<number | undefined>(undefined)
  const [showSettings, setShowSettings] = useState(false)
  const [settings, update, reset] = useSettings()
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])

  const model = useModel(csv?.text ?? null, settings, today, scope)

  if (!csv || !model) {
    return <Dropzone onLoaded={(text, name) => { setCsv({ text, name }); setScope(undefined) }} />
  }

  return (
    <div>
      <TopBar fileName={csv.name} years={model.years} scope={scope} onScope={setScope} onToggleSettings={() => setShowSettings((v) => !v)} />
      {showSettings && (
        <div style={{ padding: 'var(--pad)' }}>
          <SettingsPanel settings={settings} update={update} reset={reset} flown={model.flown}
            onReplace={() => { setCsv(null); setScope(undefined); setShowSettings(false) }} />
        </div>
      )}
      <CardGrid model={model} settings={settings} />
    </div>
  )
}
```

- [ ] **Step 8: Run the dashboard test + full suite**

Run: `npm --prefix /Users/vijayram/Cursor/flight_visualizer test`
Expected: ALL pass (engine + all app tests).

- [ ] **Step 9: Verify build + a real-data dev sanity check**

Run: `npm --prefix /Users/vijayram/Cursor/flight_visualizer run build`
Expected: single-file `dist/index.html` emitted, typecheck clean.
(Manual/optional: `npm run dev`, open the served URL, drag in `src/test/fixtures/real-sample.csv` — confirm cards render, scope dropdown lists years, settings toggles recompute. This is a human check; not automated.)

- [ ] **Step 10: Commit**

```bash
git -C /Users/vijayram/Cursor/flight_visualizer add -A
git -C /Users/vijayram/Cursor/flight_visualizer commit -m "feat(app): top bar + scope + settings panel + card grid (Phase 1 runnable)"
```

---

## Phase 1 Acceptance

- [ ] `npm test` green across engine + app (jsdom component tests).
- [ ] `npm run build` emits one self-contained `dist/index.html` (typecheck clean), openable from `file://`.
- [ ] Dropping the real export shows the five core cards; scope dropdown lists years (descending) + All-time; the four settings toggles + advanced duration constants recompute live and persist across reload; "view groupings" lists active metros; "Load a different CSV" returns to the dropzone.
- [ ] No runtime network, no web workers; reference data imported; `today` injected at the App boundary.

This delivers a runnable Phase-1 app. Plan 3 (Phases 2–3) adds the remaining core cards, the airport popup + Flight Detail click-through, and the creative cards (heatmap, odometer, records, geo-extremes, when-you-fly, aircraft, same-metal, delay) with the offline Map last.
