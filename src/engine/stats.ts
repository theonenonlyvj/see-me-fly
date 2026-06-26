import type { EnrichedFlight, Airport, Settings } from './types'
import { classifyRoute } from './classify'
import { routeKey, airportKey } from './normalize'
import { countryName, regionName } from './reference'
import { haversineMi } from './distance'
import { milestones } from './aggregate'

/** Convert a 2-letter ISO 3166-1 alpha-2 country code to a regional-indicator emoji pair.
 *  Returns '' if code is not exactly 2 ASCII alpha characters. */
export function flagEmoji(country: string): string {
  if (!/^[A-Za-z]{2}$/.test(country)) return ''
  const upper = country.toUpperCase()
  // Regional Indicator Symbol Letter A starts at U+1F1E6
  // Each code point is outside the BMP so it takes 2 UTF-16 code units (surrogate pair)
  const base = 0x1f1e6 - 0x41 // offset so that 'A' (0x41) maps to 0x1F1E6
  const a = String.fromCodePoint(base + upper.charCodeAt(0))
  const b = String.fromCodePoint(base + upper.charCodeAt(1))
  return a + b
}

// Countries for which we compute region breakdowns
const REGION_COUNTRIES = new Set(['US', 'IN', 'MX'])

export interface CountryEntry {
  code: string
  name: string
  count: number
  flag: string
  regions?: { region: string; name: string; count: number }[]
}

/**
 * For each flight with resolved endpoints, credit each DISTINCT country it
 * touches once (DFW→AUS credits US once; DFW→LHR credits US and GB).
 * Count = number of flights touching that country.
 * For US, IN, MX only: also populate `regions` with per-iso_region counts.
 * Sorted desc by count.
 */
export function byCountry(flights: EnrichedFlight[], _settings: Settings): CountryEntry[] {
  // Map: country code → count
  const countryCount = new Map<string, number>()
  // Map: country code → (region code → Set of flight IDs that touched it)
  const regionFlightIds = new Map<string, Map<string, Set<string>>>()

  for (const f of flights) {
    if (!f.resolved || !f.from || !f.to) continue

    // Collect distinct countries this flight touches
    const countries = new Set<string>()
    countries.add(f.from.country)
    if (!f.isLocalFlight) countries.add(f.to.country)

    for (const code of countries) {
      countryCount.set(code, (countryCount.get(code) ?? 0) + 1)
    }

    // Track regions for qualifying countries
    if (REGION_COUNTRIES.has(f.from.country)) {
      if (!regionFlightIds.has(f.from.country)) regionFlightIds.set(f.from.country, new Map())
      const regionMap = regionFlightIds.get(f.from.country)!
      if (!regionMap.has(f.from.region)) regionMap.set(f.from.region, new Set())
      regionMap.get(f.from.region)!.add(f.id)
    }

    if (!f.isLocalFlight && REGION_COUNTRIES.has(f.to.country)) {
      if (!regionFlightIds.has(f.to.country)) regionFlightIds.set(f.to.country, new Map())
      const regionMap = regionFlightIds.get(f.to.country)!
      if (!regionMap.has(f.to.region)) regionMap.set(f.to.region, new Set())
      regionMap.get(f.to.region)!.add(f.id)
    }
  }

  const result: CountryEntry[] = []
  for (const [code, count] of countryCount) {
    const entry: CountryEntry = {
      code,
      name: countryName(code),
      count,
      flag: flagEmoji(code),
    }
    if (REGION_COUNTRIES.has(code) && regionFlightIds.has(code)) {
      const regionMap = regionFlightIds.get(code)!
      const regions = [...regionMap.entries()]
        .map(([region, ids]) => ({
          region,
          name: regionName(region),
          count: ids.size,
        }))
        .sort((a, b) => b.count - a.count)
      entry.regions = regions
    }
    result.push(entry)
  }

  return result.sort((a, b) => b.count - a.count)
}

export interface LayoverEntry {
  key: string          // display key (metro group name when grouping, else airport code)
  airportCode: string  // the actual connecting airport code
  count: number        // number of connections through here
  avgGapMin: number    // mean layover length in minutes
}

/**
 * Common layover (connection) airports. A layover is a consecutive pair of flights
 * where you land at airport X and depart X again within `settings.layoverMaxHours`.
 * Flights are ordered chronologically by absolute departure instant (falling back to
 * date when an instant is missing). A pair counts when both legs are resolved,
 * non-local, A.toCode === B.fromCode, both instants are known, and
 * 0 < (B.depUtcMs − A.arrUtcMs) ≤ threshold. Aggregated by display key, sorted desc by count.
 */
export function commonLayovers(flights: EnrichedFlight[], settings: Settings): LayoverEntry[] {
  const maxGapMs = settings.layoverMaxHours * 3_600_000
  const sortMs = (f: EnrichedFlight) => {
    if (f.depUtcMs != null) return f.depUtcMs
    const t = Date.parse(f.date)
    return Number.isFinite(t) ? t : 0
  }
  const ordered = [...flights].sort((a, b) => sortMs(a) - sortMs(b) || a.rawIndex - b.rawIndex)

  // per connecting airport CODE
  const perCode = new Map<string, { count: number; totalGap: number }>()
  for (let i = 0; i + 1 < ordered.length; i++) {
    const A = ordered[i]
    const B = ordered[i + 1]
    if (!A.resolved || !B.resolved) continue
    if (A.isLocalFlight || B.isLocalFlight) continue
    if (A.toCode !== B.fromCode) continue
    if (A.arrUtcMs == null || B.depUtcMs == null) continue
    const gap = B.depUtcMs - A.arrUtcMs
    if (gap <= 0 || gap > maxGapMs) continue
    const cur = perCode.get(A.toCode) ?? { count: 0, totalGap: 0 }
    cur.count += 1
    cur.totalGap += gap
    perCode.set(A.toCode, cur)
  }

  // collapse to display key (metro group when grouping)
  const byKey = new Map<string, { count: number; totalGap: number; code: string }>()
  for (const [code, v] of perCode) {
    const dispKey = airportKey(code, settings.groupAirports)
    const cur = byKey.get(dispKey) ?? { count: 0, totalGap: 0, code }
    cur.count += v.count
    cur.totalGap += v.totalGap
    byKey.set(dispKey, cur)
  }

  return [...byKey.entries()]
    .map(([key, v]) => ({ key, airportCode: v.code, count: v.count, avgGapMin: Math.round(v.totalGap / v.count / 60000) }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
}

/** The 3 sub-intercontinental route tiers, in display order */
const DOMESTIC_TIERS: Array<'intra-state' | 'intra-country' | 'intra-continent'> = [
  'intra-state',
  'intra-country',
  'intra-continent',
]

/**
 * Groups flights by domestic tier (intra-state / intra-country / intra-continent).
 * Within each tier, counts occurrences by routeKey. Tiers with no routes are omitted.
 * Returned in order: intra-state, intra-country, intra-continent.
 */
export function superDomestic(
  flights: EnrichedFlight[],
  settings: Settings,
): { tier: 'intra-state' | 'intra-country' | 'intra-continent'; routes: { key: string; count: number }[] }[] {
  const tierRoutes = new Map<string, Map<string, number>>()

  for (const f of flights) {
    const cls = classifyRoute(f)
    if (!cls || cls === 'intercontinental') continue

    const key = routeKey(f, settings)
    if (key === null) continue

    if (!tierRoutes.has(cls)) tierRoutes.set(cls, new Map())
    const rm = tierRoutes.get(cls)!
    rm.set(key, (rm.get(key) ?? 0) + 1)
  }

  const result: { tier: 'intra-state' | 'intra-country' | 'intra-continent'; routes: { key: string; count: number }[] }[] = []
  for (const tier of DOMESTIC_TIERS) {
    const rm = tierRoutes.get(tier)
    if (!rm) continue
    const routes = [...rm.entries()]
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count)
    result.push({ tier, routes })
  }

  return result
}

/**
 * Intercontinental routes: classifyRoute === 'intercontinental'.
 * Keyed by routeKey, with flight count and total distanceMi.
 * Sorted desc by count.
 */
export function intercontinental(
  flights: EnrichedFlight[],
  settings: Settings,
): { key: string; count: number; miles: number }[] {
  const m = new Map<string, { count: number; miles: number }>()

  for (const f of flights) {
    if (classifyRoute(f) !== 'intercontinental') continue
    const key = routeKey(f, settings)
    if (key === null) continue

    const cur = m.get(key) ?? { count: 0, miles: 0 }
    cur.count += 1
    cur.miles += f.distanceMi ?? 0
    m.set(key, cur)
  }

  return [...m.entries()]
    .map(([key, v]) => ({ key, count: v.count, miles: v.miles }))
    .sort((a, b) => b.count - a.count)
}

// ─── New stats functions ───────────────────────────────────────────────────

/**
 * Sort flights by distance or duration, ascending (short) or descending (long).
 * Excludes flights where the metric is null.
 * For distance+short also excludes 0-mi local flights (isLocalFlight).
 * Returns first n results.
 */
export function extremeFlights(
  flights: EnrichedFlight[],
  by: 'distance' | 'duration',
  dir: 'short' | 'long',
  n = 10,
): EnrichedFlight[] {
  const metric = (f: EnrichedFlight) => by === 'distance' ? f.distanceMi : f.durationMin
  let filtered = flights.filter(f => metric(f) !== null)
  if (by === 'distance' && dir === 'short') {
    filtered = filtered.filter(f => !f.isLocalFlight)
  }
  const sorted = [...filtered].sort((a, b) => {
    const ma = metric(a)!
    const mb = metric(b)!
    return dir === 'short' ? ma - mb : mb - ma
  })
  return sorted.slice(0, n)
}

/**
 * Count flights per calendar month (YYYY-MM), sorted ascending.
 */
export function byMonth(flights: EnrichedFlight[]): { ym: string; count: number }[] {
  const m = new Map<string, number>()
  for (const f of flights) {
    const ym = f.date.slice(0, 7) // YYYY-MM
    m.set(ym, (m.get(ym) ?? 0) + 1)
  }
  return [...m.entries()]
    .map(([ym, count]) => ({ ym, count }))
    .sort((a, b) => a.ym.localeCompare(b.ym))
}

/**
 * One row per year present in the data.
 * months[0..11] = Jan..Dec counts.
 * Rows sorted descending by year.
 */
export function byYearMonthMatrix(flights: EnrichedFlight[]): { year: number; months: number[] }[] {
  const m = new Map<number, number[]>()
  for (const f of flights) {
    const year = f.year
    const monthIdx = Number(f.date.slice(5, 7)) - 1 // 0-based
    if (!m.has(year)) m.set(year, new Array(12).fill(0))
    m.get(year)![monthIdx] += 1
  }
  return [...m.entries()]
    .map(([year, months]) => ({ year, months }))
    .sort((a, b) => b.year - a.year)
}

/**
 * Length-24 array of flight counts by departure or arrival hour (local).
 * Skips flights with null hours.
 */
export function hourHistogram(flights: EnrichedFlight[], which: 'dep' | 'arr'): number[] {
  const counts = new Array<number>(24).fill(0)
  for (const f of flights) {
    const h = which === 'dep' ? f.depHourLocal : f.arrHourLocal
    if (h === null || h === undefined) continue
    counts[h] += 1
  }
  return counts
}

/**
 * Group flights by aircraft class and type.
 * byClass: all non-empty aircraftClass values (including 'unclassified'), sorted desc.
 * byType: excludes blank aircraftType strings, sorted desc.
 */
export function byAircraft(flights: EnrichedFlight[]): {
  byClass: { cls: string; count: number }[]
  byType: { type: string; count: number }[]
} {
  const clsMap = new Map<string, number>()
  const typeMap = new Map<string, number>()
  for (const f of flights) {
    if (f.aircraftClass) {
      clsMap.set(f.aircraftClass, (clsMap.get(f.aircraftClass) ?? 0) + 1)
    }
    if (f.aircraftType !== '') {
      typeMap.set(f.aircraftType, (typeMap.get(f.aircraftType) ?? 0) + 1)
    }
  }
  const byClass = [...clsMap.entries()]
    .map(([cls, count]) => ({ cls, count }))
    .sort((a, b) => b.count - a.count)
  const byType = [...typeMap.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
  return { byClass, byType }
}

/**
 * Count flights per non-blank tail number; keep only tails with count >= minFlights.
 * Sorted desc by count, tiebreak by tail string ascending.
 */
export function byTail(flights: EnrichedFlight[], minFlights = 2): { tail: string; count: number }[] {
  const m = new Map<string, number>()
  for (const f of flights) {
    if (!f.tail) continue
    m.set(f.tail, (m.get(f.tail) ?? 0) + 1)
  }
  return [...m.entries()]
    .filter(([, count]) => count >= minFlights)
    .map(([tail, count]) => ({ tail, count }))
    .sort((a, b) => b.count - a.count || a.tail.localeCompare(b.tail))
}

/**
 * Delay statistics over flights with delayMin != null.
 * onTimePct = round(100 * (# with delayMin <= 15) / counted), 0 if counted === 0.
 * mostDelayed = top 10 by delayMin desc.
 * canceled = # flights with canceled===true (over all input flights).
 * diverted = # flights with diverted===true (over all input flights).
 */
export function delayStats(flights: EnrichedFlight[]): {
  onTimePct: number
  counted: number
  mostDelayed: EnrichedFlight[]
  canceled: number
  diverted: number
} {
  const withDelay = flights.filter(f => f.delayMin !== null)
  const counted = withDelay.length
  const onTimeCount = withDelay.filter(f => f.delayMin! <= 15).length
  const onTimePct = counted === 0 ? 0 : Math.round(100 * onTimeCount / counted)
  const mostDelayed = [...withDelay]
    .sort((a, b) => b.delayMin! - a.delayMin!)
    .slice(0, 10)
  const canceled = flights.filter(f => f.canceled).length
  const diverted = flights.filter(f => f.diverted).length
  return { onTimePct, counted, mostDelayed, canceled, diverted }
}

const HOME = { lat: 32.8968, lon: -97.0380 } // DFW (default home)

/**
 * Geographic extremes over the distinct RESOLVED airports touched by all flights.
 * north=max lat, south=min lat, east=max lon, west=min lon.
 * farthest = airport with max haversineMi(home, airport); `home` defaults to DFW.
 * Returns null if no resolved airports found.
 */
export function geoExtremes(flights: EnrichedFlight[], home: { lat: number; lon: number } = HOME): {
  north: Airport
  south: Airport
  east: Airport
  west: Airport
  farthest: { airport: Airport; miles: number }
} | null {
  const airportMap = new Map<string, Airport>()
  for (const f of flights) {
    if (f.from) airportMap.set(f.from.ident, f.from)
    if (f.to && !f.isLocalFlight) airportMap.set(f.to.ident, f.to)
  }
  const airports = [...airportMap.values()]
  if (airports.length === 0) return null

  let north = airports[0]
  let south = airports[0]
  let east = airports[0]
  let west = airports[0]
  let farthestAirport = airports[0]
  let farthestMiles = haversineMi(home.lat, home.lon, airports[0].lat, airports[0].lon)

  for (const ap of airports.slice(1)) {
    if (ap.lat > north.lat) north = ap
    if (ap.lat < south.lat) south = ap
    if (ap.lon > east.lon) east = ap
    if (ap.lon < west.lon) west = ap
    const d = haversineMi(home.lat, home.lon, ap.lat, ap.lon)
    if (d > farthestMiles) {
      farthestMiles = d
      farthestAirport = ap
    }
  }

  return { north, south, east, west, farthest: { airport: farthestAirport, miles: farthestMiles } }
}

/**
 * Total distance traveled across all flights.
 * aroundEarth = round(miles/24901, 1dp).
 * toMoonPct = round(miles/238900*100, 1dp).
 */
export function odometer(flights: EnrichedFlight[]): {
  miles: number
  aroundEarth: number
  toMoonPct: number
} {
  const miles = flights.reduce((s, f) => s + (f.distanceMi ?? 0), 0)
  const aroundEarth = Math.round((miles / 24901) * 10) / 10
  const toMoonPct = Math.round((miles / 238900) * 100 * 10) / 10
  return { miles, aroundEarth, toMoonPct }
}

/**
 * Record-breaking stats over all flights.
 */
export function records(
  flights: EnrichedFlight[],
  _today: string,
): {
  mostInDay: { date: string; count: number }
  busiestMonth: { ym: string; count: number }
  busiestYear: { year: number; count: number }
  longestGapDays: number
  milestones: { ordinal: number; flight: EnrichedFlight }[]
} {
  // Most flights in a day
  const dayMap = new Map<string, number>()
  for (const f of flights) dayMap.set(f.date, (dayMap.get(f.date) ?? 0) + 1)
  let mostInDay = { date: '', count: 0 }
  for (const [date, count] of dayMap) {
    if (count > mostInDay.count || (count === mostInDay.count && date < mostInDay.date)) {
      mostInDay = { date, count }
    }
  }

  // Busiest month
  const monthMap = new Map<string, number>()
  for (const f of flights) {
    const ym = f.date.slice(0, 7)
    monthMap.set(ym, (monthMap.get(ym) ?? 0) + 1)
  }
  let busiestMonth = { ym: '', count: 0 }
  for (const [ym, count] of monthMap) {
    if (count > busiestMonth.count || (count === busiestMonth.count && ym < busiestMonth.ym)) {
      busiestMonth = { ym, count }
    }
  }

  // Busiest year
  const yearMap = new Map<number, number>()
  for (const f of flights) yearMap.set(f.year, (yearMap.get(f.year) ?? 0) + 1)
  let busiestYear = { year: 0, count: 0 }
  for (const [year, count] of yearMap) {
    if (count > busiestYear.count || (count === busiestYear.count && year < busiestYear.year)) {
      busiestYear = { year, count }
    }
  }

  // Longest gap between consecutive flight dates
  const dates = [...new Set(flights.map(f => f.date))].sort()
  let longestGapDays = 0
  for (let i = 1; i < dates.length; i++) {
    const gap = Math.round((Date.parse(dates[i]) - Date.parse(dates[i - 1])) / 86400000)
    if (gap > longestGapDays) longestGapDays = gap
  }

  // Milestones at 100, 500, 1000 (only those <= flights.length)
  const ms = milestones(flights, [100, 500, 1000])

  return {
    mostInDay,
    busiestMonth,
    busiestYear,
    longestGapDays,
    milestones: ms,
  }
}
