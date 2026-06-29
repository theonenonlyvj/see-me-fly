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
