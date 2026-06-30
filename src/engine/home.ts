import type { HomeEra, Settings } from './types'
import { airportKey } from './normalize'

/**
 * A resolved home for a given date. `airports[0] === primary`. The full `airports`
 * list is the set of co-located co-home codes for that era (used for set-membership);
 * `primary` is the single reference point for stats that need exactly one (region,
 * farthest-from-home).
 */
export interface ResolvedHome {
  airports: string[]
  primary: string
}

/**
 * True when ANY home information exists — either the time-keyed timeline
 * (`homeHistory`) or the legacy single `home`. Every `!settings.home` gate in the
 * consumers should become `hasHome(settings)` so a populated timeline with a cleared
 * scalar still counts as "has a home".
 */
export function hasHome(s: Settings): boolean {
  return s.homeHistory.length > 0 || s.home != null
}

/**
 * Pure, sanitized copy of `homeHistory`: sorted ascending by `start`, zero-length
 * (empty-airport) eras dropped, and duplicate `start`s collapsed (LAST wins). Binary
 * search assumes a strictly-ascending, non-degenerate sequence; this guarantees it
 * without mutating the caller's array. (The CSV/localStorage loader sanitizes on import
 * too — see `app/lib/see-me-fly-csv.ts`, which re-uses THIS function — keeping the
 * resolver total even if handed a raw array.)
 *
 * Canonical home-timeline sanitizer. Exported so the app-layer CSV loader can reuse it
 * (app → engine is an allowed dependency direction; engine must never import from app).
 */
export function sanitizeHomeHistory(homeHistory: HomeEra[]): HomeEra[] {
  if (homeHistory.length === 0) return []
  // Stable sort by start; for equal starts the later original index sorts last so
  // "last wins" when we drop earlier duplicates below.
  const indexed = homeHistory.map((era, i) => ({ era, i }))
  indexed.sort((a, b) => (a.era.start < b.era.start ? -1 : a.era.start > b.era.start ? 1 : a.i - b.i))
  const out: HomeEra[] = []
  for (const { era } of indexed) {
    // Drop eras with no airports (zero-length / degenerate — nothing to resolve to).
    if (!era.airports || era.airports.length === 0) continue
    // Duplicate start: last wins (the later one replaces the earlier).
    if (out.length > 0 && out[out.length - 1].start === era.start) {
      out[out.length - 1] = era
    } else {
      out.push(era)
    }
  }
  return out
}

/** Internal alias retained for readability at the resolver call sites. */
const sortedEras = sanitizeHomeHistory

/**
 * Binary-search the sanitized eras for the one whose half-open interval
 * `[start, nextStart)` contains `date`. A `date` before the first era clamps to the
 * first era (totality). Returns null only when there are no eras.
 */
function eraAt(date: string, eras: HomeEra[]): HomeEra | null {
  if (eras.length === 0) return null
  // Pre-first-era clamp: earliest known home.
  if (date < eras[0].start) return eras[0]
  let lo = 0
  let hi = eras.length - 1
  let ans = 0
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (eras[mid].start <= date) {
      ans = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return eras[ans]
}

/**
 * TOTAL home resolver. For any `date`:
 *  - If `homeHistory` is non-empty: the era containing `date` (pre-first-era clamps to
 *    the first era), as `{ airports, primary: airports[0] }`.
 *  - Else if the single `home` is set: `{ airports: [home], primary: home }`.
 *  - Else (`!hasHome`): null.
 */
export function homeAt(date: string, s: Settings): ResolvedHome | null {
  const eras = sortedEras(s.homeHistory)
  if (eras.length > 0) {
    const era = eraAt(date, eras)!
    return { airports: era.airports, primary: era.airports[0] }
  }
  if (s.home != null) {
    return { airports: [s.home], primary: s.home }
  }
  return null
}

/**
 * Boundary-aware "is this code home on this date" using key-normalized membership.
 * `airportKey(code, groupAirports)` matches ANY airport (also key-normalized) of the
 * era containing `date`. Additionally, when `date` exactly equals an era's `start`, the
 * immediately-prior era is ALSO tested — so a same-day relocation's old-home departure
 * still counts as home on the boundary date (lets it close the prior trip).
 */
export function isHomeOn(code: string, date: string, s: Settings): boolean {
  const k = airportKey(code, s.groupAirports)
  const matches = (airports: string[]): boolean =>
    airports.some((a) => airportKey(a, s.groupAirports) === k)

  const eras = sortedEras(s.homeHistory)
  if (eras.length === 0) {
    // Fall back to the single home.
    return s.home != null && airportKey(s.home, s.groupAirports) === k
  }

  // Find the index of the era containing `date` (with the pre-first-era clamp).
  let idx = 0
  if (date >= eras[0].start) {
    let lo = 0
    let hi = eras.length - 1
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (eras[mid].start <= date) {
        idx = mid
        lo = mid + 1
      } else {
        hi = mid - 1
      }
    }
  }

  if (matches(eras[idx].airports)) return true
  // On a move-day boundary, the prior era's home also counts.
  if (idx > 0 && eras[idx].start === date && matches(eras[idx - 1].airports)) return true
  return false
}

/**
 * Date-less home keys for aggregated consumers (route ordering, the map anchor, the
 * SuperDomestic title) — there's no single flight date to resolve. `keys` is the
 * set-union of `airportKey(code, groupAirports)` over EVERY era's airports (plus the
 * single `home` if set). `primaryKey` is the `airportKey` of the MOST-RECENT era's
 * primary (or the single `home`'s key, or null when `!hasHome`).
 */
export function homeKeys(s: Settings): { keys: Set<string>; primaryKey: string | null } {
  const keys = new Set<string>()
  const eras = sortedEras(s.homeHistory)
  for (const era of eras) {
    for (const code of era.airports) keys.add(airportKey(code, s.groupAirports))
  }
  if (s.home != null) keys.add(airportKey(s.home, s.groupAirports))

  let primaryKey: string | null = null
  if (eras.length > 0) {
    primaryKey = airportKey(eras[eras.length - 1].airports[0], s.groupAirports)
  } else if (s.home != null) {
    primaryKey = airportKey(s.home, s.groupAirports)
  }
  return { keys, primaryKey }
}

/**
 * The DISPLAYED home bases — the set of distinct PRIMARY metros only (each era's `airports[0]`,
 * key-normalized), NOT the full membership union. This is what "lights up" as a home base on the
 * map / in geo-extremes: a Denver era (`DEN/SEA/PAE`) contributes ONLY Denver — the co-home
 * secondaries SEA/PAE are membership-only (they still count for "at home"/trip-bracketing via the
 * `homeKeys` union + `isHomeOn`, but never surface as their own displayed base).
 *
 * `keys` = `airportKey(era.airports[0])` across all eras (distinct primaries; plus the legacy
 * single `home` when there's no timeline). `currentKey` = the MOST-RECENT era's primary key (or the
 * single `home`'s key, or null when `!hasHome`) — the one to emphasize.
 */
export function homePrimaryKeys(s: Settings): { keys: Set<string>; currentKey: string | null } {
  const keys = new Set<string>()
  const eras = sortedEras(s.homeHistory)
  for (const era of eras) keys.add(airportKey(era.airports[0], s.groupAirports))
  if (eras.length === 0 && s.home != null) keys.add(airportKey(s.home, s.groupAirports))

  let currentKey: string | null = null
  if (eras.length > 0) {
    currentKey = airportKey(eras[eras.length - 1].airports[0], s.groupAirports)
  } else if (s.home != null) {
    currentKey = airportKey(s.home, s.groupAirports)
  }
  return { keys, currentKey }
}
