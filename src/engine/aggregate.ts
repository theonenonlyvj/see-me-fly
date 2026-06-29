import type { EnrichedFlight, Settings } from './types'
import { airportKey, routeKey } from './normalize'
import { effectiveAirline } from './airline-history'
import { hasHome, isHomeOn } from './home'

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
  // DATE-AWARE home exclusion lives HERE (per-flight) rather than as a card-level post-filter, so a
  // briefly-home hub (e.g. ORD during a Chicago era) is dropped only for the years it was home and
  // still ranks for other-year visits. Gated on `excludeHomeFromRankings` + `hasHome`; an empty
  // home timeline / disabled toggle credits both endpoints exactly as before.
  // PHASE-A SIMPLIFICATION: no connection detection — a same-era pass-through through a co-home hub
  // is treated as home (within an era the hub genuinely IS home); connection-vs-arrival nuance is
  // handled only in trip reconstruction (Task 4), not duplicated in this per-flight aggregation.
  const excludeHome = settings.excludeHomeFromRankings && hasHome(settings)
  const m = new Map<string, number>()
  for (const f of flights) {
    if (!f.resolved) continue
    const codes = f.isLocalFlight ? [f.fromCode] : [f.fromCode, f.toCode]
    for (const code of codes) {
      if (excludeHome && isHomeOn(code, f.date, settings)) continue // drop the home endpoint for its home era
      m.set(airportKey(code, settings.groupAirports), (m.get(airportKey(code, settings.groupAirports)) ?? 0) + 1)
    }
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

export function byAirline(flights: EnrichedFlight[], mergeDefunct = false): { name: string; count: number; airlineCode: string }[] {
  const m = new Map<string, { count: number; codes: Map<string, number> }>()
  for (const f of flights) {
    const { code, name } = effectiveAirline(f, mergeDefunct)
    if (name === 'Unknown airline') continue
    const e = m.get(name) ?? { count: 0, codes: new Map() }
    e.count += 1
    if (code) e.codes.set(code, (e.codes.get(code) ?? 0) + 1)
    m.set(name, e)
  }
  return [...m].map(([name, e]) => ({
    name, count: e.count,
    airlineCode: [...e.codes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '',
  })).sort((a, b) => b.count - a.count)
}

/** Default internal upper edges (mi) between distance bands; user-overridable via Settings.distanceEdges. */
export const DEFAULT_DISTANCE_EDGES = [300, 700, 1500, 3000, 6000]

const fmtMi = (n: number) => n.toLocaleString('en-US')

/** Normalize a custom edge list: positive integers only, ascending, de-duplicated; fall back to default if empty. */
export function sanitizeEdges(edges?: number[]): number[] {
  const clean = [...new Set((edges ?? []).filter((n) => Number.isFinite(n) && n > 0).map((n) => Math.round(n)))]
    .sort((a, b) => a - b)
  return clean.length ? clean : [...DEFAULT_DISTANCE_EDGES]
}

/** Distance bands from arbitrary internal edges. Each band carries lo/hi (mi) for click-through; hi is exclusive
 *  (a value exactly on a boundary falls into the higher band), matching flightsByDistanceBand's [lo, hi). */
export function distanceBucketsFor(flights: EnrichedFlight[], edgesIn?: number[]): { label: string; count: number; lo: number; hi: number }[] {
  const edges = sanitizeEdges(edgesIn)
  const bounds = [0, ...edges, Infinity]
  const bands = bounds.slice(0, -1).map((lo, i) => {
    const hi = bounds[i + 1]
    const label = i === 0 ? `<${fmtMi(hi)} mi` : hi === Infinity ? `${fmtMi(lo)}+ mi` : `${fmtMi(lo)}–${fmtMi(hi)} mi`
    return { label, count: 0, lo, hi }
  })
  for (const f of flights) {
    if (f.distanceMi === null || f.distanceMi <= 0) continue
    const i = bands.findIndex((b) => f.distanceMi! < b.hi)
    if (i >= 0) bands[i].count += 1
  }
  return bands
}

export function distanceBuckets(flights: EnrichedFlight[]): { label: string; count: number }[] {
  return distanceBucketsFor(flights, DEFAULT_DISTANCE_EDGES).map(({ label, count }) => ({ label, count }))
}

export function byYear(flights: EnrichedFlight[]): { year: number; count: number }[] {
  const m = countMap(flights, (f) => String(f.year))
  return [...m].map(([y, count]) => ({ year: Number(y), count })).sort((a, b) => b.year - a.year)
}

function depTs(f: EnrichedFlight): number {
  const iso = f.date // Day-granularity sort key: EnrichedFlight carries no sub-day departure timestamp, so same-day flights tie-break by rawIndex (deterministic). TODO(Plan 2): carry gateDepSched onto EnrichedFlight for sub-day milestone precision when the Records card is built.
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
