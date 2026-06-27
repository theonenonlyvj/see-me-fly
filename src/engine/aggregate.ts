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
    const i = BUCKETS.findIndex((b) => f.distanceMi! < b.max) // strict <: a value exactly on a boundary (e.g. 300) falls into the higher band
    if (i >= 0) counts[i].count += 1
  }
  return counts
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
