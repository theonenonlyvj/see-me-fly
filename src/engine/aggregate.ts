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

export function byAirline(flights: EnrichedFlight[]): { name: string; count: number; airlineCode: string }[] {
  const m = new Map<string, { count: number; codes: Map<string, number> }>()
  for (const f of flights) {
    if (f.airlineName === 'Unknown airline') continue
    const e = m.get(f.airlineName) ?? { count: 0, codes: new Map() }
    e.count += 1
    if (f.airlineCode) e.codes.set(f.airlineCode, (e.codes.get(f.airlineCode) ?? 0) + 1)
    m.set(f.airlineName, e)
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
