import { airportIndex, lookupAirport } from '../../engine/reference'
import type { Airport } from '../../engine'

/**
 * Autocomplete search over the bundled airport reference for the editor pickers.
 * The user PICKS an airport CODE — full geocoding of an arbitrary place is out of
 * scope (the spec: the user tags the nearest airport, `fromPlace`/`toPlace` hold the
 * real place). We restrict the searchable set to airports that carry an IATA code
 * (the codes a user would ever pick / that plug into the flight graph), then match by
 * code, municipality (city), or name. Ranked: exact-code > code-prefix > word-prefix
 * city/name > substring.
 */

export interface AirportHit {
  code: string          // IATA code (what gets stored)
  municipality: string
  name: string
  region: string
  country: string
}

// Build the searchable list ONCE from the airport index (IATA-coded airports only).
// airportIndex keys include non-IATA tokens; dedupe by the resolved record's IATA.
let SEARCHABLE: AirportHit[] | null = null
function searchable(): AirportHit[] {
  if (SEARCHABLE) return SEARCHABLE
  const seen = new Set<string>()
  const out: AirportHit[] = []
  for (const ap of airportIndex.values()) {
    if (!ap.iata) continue
    const code = ap.iata.toUpperCase()
    if (seen.has(code)) continue
    seen.add(code)
    out.push({
      code,
      municipality: ap.municipality ?? '',
      name: ap.name ?? '',
      region: ap.region ?? '',
      country: ap.country ?? '',
    })
  }
  SEARCHABLE = out
  return out
}

/** Format an airport for display in a list/option: "Dallas-Fort Worth (DFW)". */
export function airportLabel(code: string): string {
  const ap = lookupAirport(code)
  if (!ap) return code
  return ap.municipality ? `${ap.municipality} (${code})` : `${ap.name || code} (${code})`
}

/**
 * Search the reference by code / city / name. Returns up to `limit` ranked hits.
 * An empty query returns []. Matching is case-insensitive and ignores surrounding
 * whitespace.
 */
export function searchAirports(query: string, limit = 8): AirportHit[] {
  const q = query.trim().toUpperCase()
  if (!q) return []
  const list = searchable()
  const scored: { hit: AirportHit; score: number }[] = []
  for (const hit of list) {
    const code = hit.code
    const muni = hit.municipality.toUpperCase()
    const name = hit.name.toUpperCase()
    let score = -1
    if (code === q) score = 0
    else if (code.startsWith(q)) score = 1
    else if (muni.startsWith(q) || name.startsWith(q)) score = 2
    else if (muni.includes(` ${q}`) || name.includes(` ${q}`)) score = 3
    else if (muni.includes(q) || name.includes(q)) score = 4
    if (score >= 0) scored.push({ hit, score })
  }
  scored.sort((a, b) => a.score - b.score || a.hit.code.localeCompare(b.hit.code))
  return scored.slice(0, limit).map((s) => s.hit)
}

export type { Airport }
