import Papa from 'papaparse'
import type { HomeEra, GroundLink } from '../../engine/types'
import { sanitizeHomeHistory } from '../../engine/home'

/**
 * Branded "see-me-fly" CSV format for the user-owned home timeline + ground segments.
 * Both files carry a `schema_version` column so a future column change can anchor a
 * migration. RFC-4180 quoting is handled by PapaParse (`Papa.unparse`/`Papa.parse`,
 * the SAME dependency the Flighty flight CSV parser uses in `engine/parse.ts`) so
 * free-text fields with embedded commas/quotes ("Cambridge, MA"; 'RedCoach, Inc.') and
 * leading-zero booking refs round-trip without corruption.
 *
 * Pure functions only — no localStorage here (that wiring is Task 8).
 */
export const SMF_SCHEMA_VERSION = 1

/** Re-exported so the editor/loader has one import for the canonical sanitizer. */
export { sanitizeHomeHistory }

/**
 * Header + schema_version guard shared by both parsers (MUST-FIX 2). Returns an error STRING when
 * the file should be REJECTED (parsers then emit zero rows so a malformed/wrong-shape file can never
 * wipe the saved data), or null when it's safe to parse:
 *  - A file with data rows must carry every `required` column; missing any → reject (this catches a
 *    Flighty flight CSV dropped into the homes/links slot).
 *  - A `schema_version` newer than `SMF_SCHEMA_VERSION` in any row → reject (never import a higher
 *    version; the columns may have changed meaning).
 *  - A header-only file (zero data rows) is allowed through — that's the legitimate "clear the list"
 *    action, handled by the caller, not a malformed import.
 */
function checkSchema(
  headers: string[],
  data: Record<string, string>[],
  required: string[],
  kind: 'homes' | 'links',
): string | null {
  // Header-only / empty file: nothing to validate; let the caller decide whether to clear.
  if (data.length === 0) return null
  const have = new Set(headers)
  const missing = required.filter((c) => !have.has(c))
  if (missing.length > 0) {
    return `Not a see-me-fly ${kind} CSV — missing required column(s): ${missing.join(', ')}. Nothing was changed.`
  }
  if (have.has('schema_version')) {
    for (const r of data) {
      const raw = (r.schema_version ?? '').trim()
      if (raw === '') continue
      const v = Number(raw)
      if (Number.isFinite(v) && v > SMF_SCHEMA_VERSION) {
        return `This file is schema_version ${raw}, newer than this app supports (${SMF_SCHEMA_VERSION}). Update the app to import it. Nothing was changed.`
      }
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// homes.csv
// ---------------------------------------------------------------------------

const HOMES_HEADER = ['schema_version', 'start_date', 'home_airports', 'label'] as const

/**
 * Serialize a home timeline to `see-me-fly_homes.csv` text. `home_airports` is
 * slash-joined (`MKE/ORD/MDW`); the first code is the PRIMARY. A missing `label`
 * serializes as an empty field.
 */
export function serializeHomesCsv(eras: HomeEra[]): string {
  const rows = eras.map((e) => ({
    schema_version: SMF_SCHEMA_VERSION,
    start_date: e.start,
    home_airports: e.airports.join('/'),
    label: e.label ?? '',
  }))
  return Papa.unparse({ fields: [...HOMES_HEADER], data: rows })
}

/**
 * Parse `see-me-fly_homes.csv` text. Runs the result through `sanitizeHomeHistory`
 * (sort asc by start; drop empty-airport eras; collapse duplicate starts last-wins),
 * and surfaces an `errors[]` note when sanitization changed the row set — never throws.
 */
export function parseHomesCsv(text: string): { eras: HomeEra[]; errors: string[] } {
  const errors: string[] = []
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    worker: false,
  })
  for (const err of parsed.errors ?? []) {
    errors.push(`CSV parse error${err.row != null ? ` (row ${err.row})` : ''}: ${err.message}`)
  }

  // Schema/header guard (MUST-FIX 2): a wrong-shape file (e.g. a Flighty flight CSV pasted into the
  // homes slot) must yield ZERO rows + an error so the importer never wipes the saved timeline.
  const headers = parsed.meta?.fields ?? []
  const schemaErr = checkSchema(headers, parsed.data, ['start_date', 'home_airports'], 'homes')
  if (schemaErr) return { eras: [], errors: [...errors, schemaErr] }

  const raw: HomeEra[] = []
  for (const r of parsed.data) {
    const start = (r.start_date ?? '').trim()
    const airports = (r.home_airports ?? '')
      .split('/')
      .map((a) => a.trim())
      .filter((a) => a.length > 0)
    const label = (r.label ?? '').trim()
    const era: HomeEra = { start, airports }
    if (label) era.label = label
    raw.push(era)
  }

  const eras = sanitizeHomeHistory(raw)
  // Surface a note if sanitization dropped or de-duped anything so the importer can
  // report it (rows added/updated/errors), per the loader-hardening requirement.
  const dropped = raw.length - eras.length
  if (dropped > 0) {
    errors.push(
      `Sanitized home timeline: ${dropped} row(s) dropped or merged (empty-airport, duplicate-start last-wins, or re-sorted).`,
    )
  }

  return { eras, errors }
}

// ---------------------------------------------------------------------------
// links.csv
// ---------------------------------------------------------------------------

/**
 * Column order for `see-me-fly_links.csv`: `schema_version` + every `GroundLink` field.
 * The `klass` field maps to a human-readable `class` column. Tuple of
 * [csvColumn, GroundLink key] so the mapping is the single source of truth.
 */
const LINK_COLUMNS: ReadonlyArray<readonly [string, keyof GroundLink]> = [
  ['date', 'date'],
  ['from_airport', 'fromAirport'],
  ['to_airport', 'toAirport'],
  ['mode', 'mode'],
  ['arrive_date', 'arriveDate'],
  ['from_place', 'fromPlace'],
  ['to_place', 'toPlace'],
  ['depart_time', 'departTime'],
  ['arrive_time', 'arriveTime'],
  ['operator', 'operator'],
  ['price', 'price'],
  ['currency', 'currency'],
  ['booking_ref', 'bookingRef'],
  ['seat', 'seat'],
  ['class', 'klass'],
  ['note', 'note'],
]

const LINKS_HEADER = ['schema_version', ...LINK_COLUMNS.map(([col]) => col)]

/** Optional string fields that are emitted only when non-blank. */
const OPTIONAL_STRING_FIELDS: ReadonlyArray<keyof GroundLink> = [
  'arriveDate',
  'fromPlace',
  'toPlace',
  'departTime',
  'arriveTime',
  'operator',
  'currency',
  'bookingRef',
  'seat',
  'klass',
  'note',
]

/** Serialize ground segments to `see-me-fly_links.csv`. Blank optional fields → empty. */
export function serializeLinksCsv(links: GroundLink[]): string {
  const data = links.map((l) => {
    const row: Record<string, string | number> = { schema_version: SMF_SCHEMA_VERSION }
    for (const [col, key] of LINK_COLUMNS) {
      const v = l[key]
      // price is a number; everything else a string. Blanks serialize as "".
      row[col] = v == null ? '' : (v as string | number)
    }
    return row
  })
  return Papa.unparse({ fields: LINKS_HEADER, data })
}

/**
 * Parse a number out of a CSV price cell. PapaParse has already done RFC-4180
 * unquoting, so we only strip thousands separators / stray whitespace. Returns
 * undefined for blanks or anything that doesn't parse to a finite number (never NaN).
 */
function parsePrice(p: string): number | undefined {
  const cleaned = String(p).replace(/[,\s]/g, '')
  if (cleaned === '') return undefined
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : undefined
}

/**
 * Parse `see-me-fly_links.csv` text. Blanks → omitted optional fields. The `class`
 * column maps back to `klass`. `price` is parsed only after unquoting + stripping
 * thousands separators; a `price` with a blank `currency` keeps `price` and leaves
 * `currency` undefined (a currency is never invented). Never throws.
 */
export function parseLinksCsv(text: string): { links: GroundLink[]; errors: string[] } {
  const errors: string[] = []
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    worker: false,
  })
  for (const err of parsed.errors ?? []) {
    errors.push(`CSV parse error${err.row != null ? ` (row ${err.row})` : ''}: ${err.message}`)
  }

  // Schema/header guard (MUST-FIX 2): reject a wrong-shape file with zero rows + an error.
  const headers = parsed.meta?.fields ?? []
  const schemaErr = checkSchema(headers, parsed.data, ['date', 'from_airport', 'to_airport'], 'links')
  if (schemaErr) return { links: [], errors: [...errors, schemaErr] }

  const links: GroundLink[] = parsed.data.map((r) => {
    const get = (col: string): string => (r[col] ?? '').trim()
    const link: GroundLink = {
      date: get('date'),
      fromAirport: get('from_airport'),
      toAirport: get('to_airport'),
      mode: get('mode'),
    }
    // Optional string fields: omit when blank (never set undefined-but-present keys).
    for (const [col, key] of LINK_COLUMNS) {
      if (!OPTIONAL_STRING_FIELDS.includes(key)) continue
      const v = get(col)
      if (v) (link[key] as string) = v
    }
    // price: numeric, guarded; blank currency keeps price, currency stays undefined.
    const price = parsePrice(get('price'))
    if (price !== undefined) link.price = price
    return link
  })

  return { links, errors }
}
