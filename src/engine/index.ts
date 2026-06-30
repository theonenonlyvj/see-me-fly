import type { Settings } from './types'
import { parseFlightyCsv } from './parse'
import { enrichFlight } from './enrich'
import { applyFilters } from './filter'
import { byAirport, byRoute, byAirline, distanceBuckets, DEFAULT_DISTANCE_EDGES, byYear, totals } from './aggregate'
import { DEFAULT_DURATION_CONSTANTS } from './constants'

export const DEFAULT_SETTINGS: Settings = {
  groupAirports: true,
  explicitlyUnique: false,
  includeCanceled: false,
  excludeBeforeDate: null,
  home: null,
  homeHistory: [],
  groundLinks: [],
  excludeHomeFromRankings: true,
  layoverMaxHours: 5,
  excludeDayTrips: true,
  splitCountriesByState: ['US', 'IN', 'MX'],
  distanceEdges: [...DEFAULT_DISTANCE_EDGES],
  mergeDefunctAirlines: false,
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
    // The active year-scope (undefined = all-time). Exposed so cards that must reconstruct over
    // ALL-TIME flights (trips) can re-slice their own result by the scope year — they receive the
    // model, not the App's `scope` state.
    scopeYear: scopeYear ?? null,
    unresolved,
    years,
    totals: totals(scoped, settings),
    byAirport: byAirport(scoped, settings),
    byRoute: byRoute(scoped, settings),
    byAirline: byAirline(scoped, settings.mergeDefunctAirlines),
    distanceBuckets: distanceBuckets(scoped),
  }
}

export * from './types'
