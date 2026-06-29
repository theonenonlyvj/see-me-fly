import type { EnrichedFlight, Airport, Settings, Continent, AircraftClass } from './types'
import { classifyRoute } from './classify'
import { routeKey, airportKey } from './normalize'
import { countryName, regionName, aircraftFamily, lookupAirport, continentName } from './reference'
import { haversineMi } from './distance'
import { milestones } from './aggregate'
import { DEFUNCT_AIRLINES, effectiveAirline } from './airline-history'
import { hasHome, isHomeOn } from './home'
import { buildMovements, type Movement } from './ground-links'

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
export function byCountry(flights: EnrichedFlight[], settings: Settings): CountryEntry[] {
  // Map: country code → count
  const countryCount = new Map<string, number>()
  // Map: country code → (region code → Set of flight IDs that touched it)
  const regionFlightIds = new Map<string, Map<string, Set<string>>>()

  // Optionally don't credit the HOME endpoint, so a flight counts only toward where you WENT
  // (DFW→ORD credits Illinois, not Texas-via-Dallas). Home matched by metro key.
  const homeMetro = settings.excludeHomeFromRankings && settings.home
    ? airportKey(settings.home, settings.groupAirports) : null
  const isHome = (code: string) => homeMetro !== null && airportKey(code, settings.groupAirports) === homeMetro

  const creditRegion = (country: string, region: string, id: string) => {
    if (!REGION_COUNTRIES.has(country)) return
    if (!regionFlightIds.has(country)) regionFlightIds.set(country, new Map())
    const regionMap = regionFlightIds.get(country)!
    if (!regionMap.has(region)) regionMap.set(region, new Set())
    regionMap.get(region)!.add(id)
  }

  for (const f of flights) {
    if (!f.resolved || !f.from || !f.to) continue
    const fromHome = isHome(f.fromCode)
    const toHome = isHome(f.toCode)

    // Collect distinct countries this flight touches (skipping the home endpoint)
    const countries = new Set<string>()
    if (!fromHome) countries.add(f.from.country)
    if (!f.isLocalFlight && !toHome) countries.add(f.to.country)
    for (const code of countries) countryCount.set(code, (countryCount.get(code) ?? 0) + 1)

    if (!fromHome) creditRegion(f.from.country, f.from.region, f.id)
    if (!f.isLocalFlight && !toHome) creditRegion(f.to.country, f.to.region, f.id)
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
    // day-trip turnaround: landed at X then flew back to where we came from → not a layover
    if (settings.excludeDayTrips && airportKey(A.fromCode, settings.groupAirports) === airportKey(B.toCode, settings.groupAirports)) continue
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
/**
 * Which super-domestic tier a flight belongs to (or null if intercontinental/unclassifiable).
 * intra-state is scoped to the HOME state: a same-state route in another state is just same-country.
 */
export function domesticTierOf(f: EnrichedFlight, settings: Settings): 'intra-state' | 'intra-country' | 'intra-continent' | null {
  let cls = classifyRoute(f)
  if (!cls || cls === 'intercontinental') return null
  const homeRegion = settings.home ? (lookupAirport(settings.home)?.region ?? null) : null
  if (cls === 'intra-state' && homeRegion && f.from && f.from.region !== homeRegion) cls = 'intra-country'
  return cls
}

export function superDomestic(
  flights: EnrichedFlight[],
  settings: Settings,
): { tier: 'intra-state' | 'intra-country' | 'intra-continent'; routes: { key: string; count: number }[] }[] {
  const tierRoutes = new Map<string, Map<string, number>>()

  for (const f of flights) {
    const cls = domesticTierOf(f, settings)
    if (!cls) continue

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

export interface ContinentPairGroup {
  pair: string          // sorted continent codes joined, e.g. "EU|NA" (used as a click-through id)
  label: string         // "North America ↔ Europe"
  count: number
  routes: { key: string; count: number }[]
}

/**
 * Intercontinental flights grouped by the (unordered) continent pair they cross.
 * Each group lists its routes (by routeKey). Groups + routes sorted desc by count.
 */
export function intercontinentalByPair(flights: EnrichedFlight[], settings: Settings): ContinentPairGroup[] {
  const groups = new Map<string, { conts: [Continent, Continent]; routes: Map<string, number>; count: number }>()
  for (const f of flights) {
    if (classifyRoute(f) !== 'intercontinental' || !f.from || !f.to) continue
    const key = routeKey(f, settings)
    if (key === null) continue
    const conts = [f.from.continent, f.to.continent].sort() as [Continent, Continent]
    const pairKey = conts.join('|')
    let g = groups.get(pairKey)
    if (!g) { g = { conts, routes: new Map(), count: 0 }; groups.set(pairKey, g) }
    g.count += 1
    g.routes.set(key, (g.routes.get(key) ?? 0) + 1)
  }
  return [...groups.values()]
    .map((g) => ({
      pair: g.conts.join('|'),
      label: `${continentName(g.conts[0])} ↔ ${continentName(g.conts[1])}`,
      count: g.count,
      routes: [...g.routes.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count),
    }))
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
  // duration 0 = data artifact; distance 0 = a REAL local flight (e.g. RPJ skydiving), keep it
  if (dir === 'short' && by === 'duration') {
    filtered = filtered.filter(f => (metric(f) as number) > 0)
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
export function byAircraft(flights: EnrichedFlight[], groupFamilies = false): {
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
      const key = groupFamilies ? aircraftFamily(f.aircraftType) : f.aircraftType
      typeMap.set(key, (typeMap.get(key) ?? 0) + 1)
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
export interface TailEntry { tail: string; count: number; airline: string; airlineCode: string; multipleAirlines: boolean }

export function byTail(flights: EnrichedFlight[], minFlights = 2): TailEntry[] {
  const m = new Map<string, { count: number; airlines: Map<string, number>; codes: Map<string, number> }>()
  for (const f of flights) {
    if (!f.tail) continue
    const e = m.get(f.tail) ?? { count: 0, airlines: new Map(), codes: new Map() }
    e.count += 1
    if (f.airlineName && f.airlineName !== 'Unknown airline') e.airlines.set(f.airlineName, (e.airlines.get(f.airlineName) ?? 0) + 1)
    if (f.airlineCode) e.codes.set(f.airlineCode, (e.codes.get(f.airlineCode) ?? 0) + 1)
    m.set(f.tail, e)
  }
  return [...m.entries()]
    .filter(([, e]) => e.count >= minFlights)
    .map(([tail, e]) => {
      const topAirline = [...e.airlines.entries()].sort((a, b) => b[1] - a[1])[0]
      const topCode = [...e.codes.entries()].sort((a, b) => b[1] - a[1])[0]
      return { tail, count: e.count, airline: topAirline?.[0] ?? '', airlineCode: topCode?.[0] ?? '', multipleAirlines: e.airlines.size > 1 }
    })
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

/** Top-N longest grounded gaps (days between consecutive flight dates), with the bounding dates. */
export function groundGaps(flights: EnrichedFlight[], n = 10): { days: number; from: string; to: string }[] {
  const dates = [...new Set(flights.map((f) => f.date))].sort()
  const gaps: { days: number; from: string; to: string }[] = []
  for (let i = 1; i < dates.length; i++) {
    const days = Math.round((Date.parse(dates[i]) - Date.parse(dates[i - 1])) / 86400000)
    if (days > 0) gaps.push({ days, from: dates[i - 1], to: dates[i] })
  }
  return gaps.sort((a, b) => b.days - a.days).slice(0, n)
}

// ── Time / behavioral aggregators (additive cards) ──────────────────────────

/** Weekday key (0=Mon … 6=Sun) for a YYYY-MM-DD date, computed in UTC to stay deterministic. */
export function weekdayMonFirst(date: string): number | null {
  const t = Date.parse(date + 'T00:00:00Z')
  if (!Number.isFinite(t)) return null
  return (new Date(t).getUTCDay() + 6) % 7 // getUTCDay: 0=Sun → Mon-first
}

export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** Flight counts per weekday, Monday-first (index 0=Mon … 6=Sun). */
export function byWeekday(flights: EnrichedFlight[]): number[] {
  const counts = new Array(7).fill(0)
  for (const f of flights) {
    const w = weekdayMonFirst(f.date)
    if (w !== null) counts[w] += 1
  }
  return counts
}

export type HomeTier = 'intra-state' | 'intra-country' | 'intra-continent' | 'intercontinental'
export const HOME_TIER_LABELS: Record<HomeTier, string> = {
  'intra-state': 'In-state', 'intra-country': 'Domestic', 'intra-continent': 'Continental', intercontinental: 'Intercontinental',
}

/** One mutually-exclusive "how far from home" tier per resolved flight, closest→farthest. */
export function homeDistanceTiers(flights: EnrichedFlight[], settings: Settings): { tier: HomeTier; count: number }[] {
  const counts: Record<HomeTier, number> = { 'intra-state': 0, 'intra-country': 0, 'intra-continent': 0, intercontinental: 0 }
  for (const f of flights) {
    if (!f.resolved || f.isLocalFlight) continue
    const tier = domesticTierOf(f, settings)
    counts[tier ?? 'intercontinental'] += 1 // domesticTierOf → null means resolved cross-continent
  }
  return (['intra-state', 'intra-country', 'intra-continent', 'intercontinental'] as HomeTier[]).map((tier) => ({ tier, count: counts[tier] }))
}

/** Flights per aircraft body class, ordered wide→narrow→regional→prop→unclassified, zero-classes dropped. */
export function aircraftClassCounts(flights: EnrichedFlight[]): { cls: AircraftClass; count: number }[] {
  const m = new Map<AircraftClass, number>()
  for (const f of flights) {
    const c = f.aircraftClass || 'unclassified'
    m.set(c, (m.get(c) ?? 0) + 1)
  }
  const order: AircraftClass[] = ['wide', 'narrow', 'regional', 'prop', 'unclassified']
  return order.map((cls) => ({ cls, count: m.get(cls) ?? 0 })).filter((x) => x.count > 0)
}

/** Per-year flight counts split across the top-N airlines (by name) + an "Other" bucket — for stacked eras. */
export function airlineByYear(flights: EnrichedFlight[], topN = 2, mergeDefunct = false): { years: number[]; series: { name: string; counts: number[] }[] } {
  const nameOf = (f: EnrichedFlight) => effectiveAirline(f, mergeDefunct).name
  const totals = new Map<string, number>()
  for (const f of flights) {
    const name = nameOf(f)
    if (!name || name === 'Unknown airline') continue
    totals.set(name, (totals.get(name) ?? 0) + 1)
  }
  const top = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, topN).map((e) => e[0])
  const topSet = new Set(top)
  const years = [...new Set(flights.map((f) => f.year))].filter((y) => Number.isFinite(y)).sort((a, b) => a - b)
  const yearIdx = new Map(years.map((y, i) => [y, i]))
  const series = [...top.map((name) => ({ name, counts: new Array(years.length).fill(0) })), { name: 'Other', counts: new Array(years.length).fill(0) }]
  const byName = new Map(series.map((s) => [s.name, s]))
  for (const f of flights) {
    const name = nameOf(f)
    if (!name || name === 'Unknown airline') continue
    const i = yearIdx.get(f.year)
    if (i === undefined) continue
    const s = topSet.has(name) ? byName.get(name)! : byName.get('Other')!
    s.counts[i] += 1
  }
  return { years, series }
}

// ── Identity / behavioral cards (batch 2) ───────────────────────────────────

/** Departure time-of-day profile. depHourLocal is 0-23 local (no tz shift). */
export function redEyeProfile(flights: EnrichedFlight[]): {
  redEyes: number; dawnPatrol: number; hourCounts: number[]; withTime: number; commonHour: number | null
} {
  const hourCounts = new Array(24).fill(0)
  let redEyes = 0, dawnPatrol = 0, withTime = 0
  for (const f of flights) {
    const h = f.depHourLocal
    if (h === null || h === undefined) continue
    withTime += 1
    hourCounts[h] += 1
    // A red-eye must run THROUGH the night: a late departure AND a real overnight haul (>= 3h).
    // Excludes short late hops like a 10pm Houston→Dallas 1-hour flight.
    if ((h >= 21 || h <= 4) && f.durationMin != null && f.durationMin >= 180) redEyes += 1
    if (h >= 5 && h <= 6) dawnPatrol += 1   // pre-7am "dawn patrol"
  }
  const commonHour = withTime > 0 ? hourCounts.indexOf(Math.max(...hourCounts)) : null
  return { redEyes, dawnPatrol, hourCounts, withTime, commonHour }
}

export interface FleetStats { distinctTails: number; withTail: number; oneTimers: number; mostRepeated: { tail: string; count: number; airline: string } | null }

/** The personal fleet: how many distinct airframes (tail numbers), the most-ridden one, and one-timers. */
export function fleetStats(flights: EnrichedFlight[]): FleetStats {
  const m = new Map<string, { count: number; airline: string }>()
  for (const f of flights) {
    const t = (f.tail || '').trim()
    if (!t) continue
    const cur = m.get(t) ?? { count: 0, airline: f.airlineName }
    cur.count += 1
    m.set(t, cur)
  }
  let withTail = 0, oneTimers = 0
  let mostRepeated: FleetStats['mostRepeated'] = null
  for (const [tail, v] of m) {
    withTail += v.count
    if (v.count === 1) oneTimers += 1
    if (!mostRepeated || v.count > mostRepeated.count) mostRepeated = { tail, count: v.count, airline: v.airline }
  }
  return { distinctTails: m.size, withTail, oneTimers, mostRepeated }
}


/** Carriers you flew that no longer exist, with your flight count, last flight, and fate. */
export function ghostAirlines(flights: EnrichedFlight[]): { code: string; name: string; count: number; last: string; fate: string }[] {
  const m = new Map<string, { name: string; count: number; last: string }>()
  for (const f of flights) {
    const code = f.airlineCode
    if (!DEFUNCT_AIRLINES[code]) continue
    const cur = m.get(code) ?? { name: f.airlineName, count: 0, last: f.date }
    cur.count += 1
    if (f.date > cur.last) cur.last = f.date
    m.set(code, cur)
  }
  return [...m.entries()]
    .map(([code, v]) => ({ code, name: v.name, count: v.count, last: v.last, fate: DEFUNCT_AIRLINES[code] }))
    .sort((a, b) => b.count - a.count)
}

// ── Trip reconstruction (batch 3): group legs into home-anchored journeys ────

export interface Trip {
  flights: EnrichedFlight[]
  departDate: string
  returnDate: string
  nights: number            // calendar nights between leaving home and returning
  year: number              // year of departure
  outboundWeekday: number   // 0=Mon … 6=Sun
  returnWeekday: number
  roundTrip: boolean        // ended back at home
  destinations: string[]    // distinct non-home airport keys touched
  estimated?: { boundary: 'start' | 'end' }  // set when a trip boundary was inferred (no recorded leg/link); derived, not persisted
}

/**
 * Group chronological movements (flights + ground links) into trips bracketed by a
 * DATE-AWARE home, over ALL-TIME flights (callers pass `model.flown`; the year dropdown
 * slices the result via `tripsForYear`). A trip accumulates flight legs; ground links
 * BRIDGE a gap to a new away-location (extending an open trip) or CLOSE it when they land
 * at a home airport. Rules (spec §"Trip Reconstruction"):
 *  - Home per movement via `isHomeOn(endpoint, mvmt.date)` (set-membership, boundary-aware).
 *  - Arrive-home CLOSES, UNLESS the next movement redeparts the SAME airport within
 *    `layoverMaxHours` (a connection — e.g. a co-home hub on a layover), which keeps it open.
 *  - A ground link to home closes; a link to a non-home bridges (never closes).
 *  - A fresh depart-from-home closes any still-open prior trip.
 *  - Inferred boundaries: a trip that left home with no recorded return/link closes at its
 *    last recorded leg's date with `estimated:{boundary:'end'}`; a lone homeward leg
 *    (no prior departure) is a 0-night trip with `estimated:{boundary:'start'}`.
 * Needs some home (`hasHome`); returns [] otherwise. Only `kind:'flight'` movements
 * populate a trip's flight list/stats — links are bridges only.
 */
export function reconstructTrips(flights: EnrichedFlight[], settings: Settings): Trip[] {
  if (!hasHome(settings)) return []
  const k = (c: string) => airportKey(c, settings.groupAirports)
  const maxGapMs = settings.layoverMaxHours * 3_600_000

  const usable = flights.filter((f) => f.resolved && !f.isLocalFlight)
  const movements = buildMovements(usable, settings.groundLinks)

  // The arrival date a movement lands on (for the home check): a link can arrive a later day.
  const arriveDateOf = (m: Movement) => (m.kind === 'link' ? (m.link.arriveDate ?? m.date) : m.date)
  // The absolute arrival instant, for the connection (layover) exception. Links rarely carry one.
  const arrInstant = (m: Movement): number | null => {
    if (m.kind === 'flight') return m.flight.arrUtcMs
    if (m.link.arriveDate || m.link.arriveTime) {
      const d = m.link.arriveDate ?? m.date
      const t = Date.parse(`${d}T00:00:00Z`)
      if (!Number.isFinite(t)) return null
      const mm = m.link.arriveTime ? /^(\d{1,2}):(\d{2})/.exec(m.link.arriveTime) : null
      return t + (mm ? (Number(mm[1]) * 60 + Number(mm[2])) * 60_000 : 0)
    }
    return null
  }

  const trips: Trip[] = []
  // `cur` = the flight legs of the open trip; `bridged` flags a link extended it (so it's not
  // a phantom empty trip); `startInferred` flags a trip that opened on a homeward leg.
  let cur: EnrichedFlight[] = []
  let open = false
  let startInferred = false
  let lastArrive = '' // arrival date of the last movement added to the open trip

  const close = (boundary?: 'start' | 'end') => {
    if (!open) return
    open = false
    if (!cur.length) { startInferred = false; lastArrive = ''; return }
    const first = cur[0]
    const last = cur[cur.length - 1]
    // The trip's return date is when the LAST movement landed (a closing link can land later
    // than the last flight). For an inferred end we collapse to the last recorded leg's date.
    const returnDate = boundary === 'end' ? last.date : (lastArrive || last.date)
    const nights = Math.max(0, Math.round((Date.parse(returnDate) - Date.parse(first.date)) / 86_400_000))
    const dests = new Set<string>()
    for (const f of cur) if (!isHomeOn(f.toCode, f.date, settings)) dests.add(k(f.toCode))
    const estimated = boundary ? { boundary } : (startInferred ? { boundary: 'start' as const } : undefined)
    trips.push({
      flights: cur, departDate: first.date, returnDate, nights, year: first.year,
      outboundWeekday: weekdayMonFirst(first.date) ?? 0, returnWeekday: weekdayMonFirst(returnDate) ?? 0,
      // A trip closed by reaching home (flight or link) round-trips; an inferred-end one doesn't.
      roundTrip: boundary !== 'end',
      destinations: [...dests],
      ...(estimated ? { estimated } : {}),
    })
    cur = []
    startInferred = false
    lastArrive = ''
  }

  // Is movement `j` a connection redeparture of movement `j-1`? (prev landed exactly where this
  // departs, and re-departed within `layoverMaxHours`). A connection through a co-home hub must
  // NOT read as a fresh "depart-from-home" (that would split a layover at e.g. ORD/MKE).
  const isConnectionFrom = (prev: Movement | undefined, m: Movement): boolean => {
    if (!prev || prev.toCode !== m.fromCode) return false
    const a = arrInstant(prev)
    const d = m.kind === 'flight' ? m.flight.depUtcMs : m.sortMs
    if (a == null || d == null) return false
    const gap = d - a
    return gap > 0 && gap <= maxGapMs
  }

  for (let i = 0; i < movements.length; i++) {
    const m = movements[i]
    const departHome = isHomeOn(m.fromCode, m.date, settings)
    const arriveHome = isHomeOn(m.toCode, arriveDateOf(m), settings)
    const connectionIn = isConnectionFrom(movements[i - 1], m)

    // A fresh departure FROM home means any still-open prior trip ended some other way
    // (you got home, then left again). Close it (inferred end) before opening anew — UNLESS this
    // is a connection redeparture of the previous leg (a layover at a co-home hub), which keeps
    // the trip open.
    if (open && departHome && !connectionIn) close('end')

    if (!open) {
      // Opening a new trip. If the very first movement lands home (a lone homeward leg with no
      // recorded departure), it's a 0-night inferred-start blip.
      open = true
      startInferred = !departHome && arriveHome
    }

    if (m.kind === 'flight') cur.push(m.flight) // links are bridges only — not in the flight list
    lastArrive = arriveDateOf(m)

    if (arriveHome) {
      // Arrived a home airport. Close UNLESS the next movement is a connection: it redeparts the
      // SAME airport within `layoverMaxHours` (a co-home hub on a layover must not split the trip).
      const next = movements[i + 1]
      let isConnection = false
      if (next && next.fromCode === m.toCode) {
        const a = arrInstant(m)
        const d = next.kind === 'flight' ? next.flight.depUtcMs : next.sortMs
        if (a != null && d != null) {
          const gap = d - a
          if (gap > 0 && gap <= maxGapMs) isConnection = true
        }
      }
      if (!isConnection) close()
    }
    // A link to a NON-home airport bridges (extends the open trip); nothing to do — it already
    // updated `lastArrive` and the loop continues with the trip still open.
  }
  close('end') // any trip still open at the end had no recorded return → inferred end
  return trips
}

/**
 * Slice an all-time `Trip[]` by year. `null` (or undefined) = all-time (no slice); otherwise
 * keep trips whose departure year (`Trip.year`) matches. Reconstruction runs once over all-time
 * flights (so a cross-year relocation stays one trip); this attributes each trip to its
 * departure year, exactly as the year dropdown scopes everything else.
 */
export function tripsForYear(trips: Trip[], year: number | null): Trip[] {
  if (year == null) return trips
  return trips.filter((t) => t.year === year)
}

const modeOf = (arr: number[]): number | null => {
  if (!arr.length) return null
  const m = new Map<number, number>()
  for (const x of arr) m.set(x, (m.get(x) ?? 0) + 1)
  return [...m.entries()].sort((a, b) => b[1] - a[1])[0][0]
}

/** Roll-up of trips for the Commuter Cadence + Nights Away cards. */
export function tripSummary(trips: Trip[]): {
  tripCount: number; roundTrips: number; totalNights: number; medianNights: number; longest: Trip | null
  commonOutbound: number | null; commonReturn: number | null; businessPct: number
  nightsByYear: { year: number; nights: number }[]
} {
  const round = trips.filter((t) => t.roundTrip)
  const nightsSorted = round.map((t) => t.nights).filter((n) => n > 0).sort((a, b) => a - b)
  const medianNights = nightsSorted.length ? nightsSorted[Math.floor(nightsSorted.length / 2)] : 0
  const totalNights = trips.reduce((s, t) => s + t.nights, 0)
  let longest: Trip | null = null
  for (const t of trips) if (!longest || t.nights > longest.nights) longest = t
  const business = round.filter((t) => t.nights >= 1 && t.nights <= 4 && t.outboundWeekday <= 3).length
  const byYear = new Map<number, number>()
  for (const t of trips) byYear.set(t.year, (byYear.get(t.year) ?? 0) + t.nights)
  return {
    tripCount: trips.length, roundTrips: round.length, totalNights, medianNights, longest,
    commonOutbound: modeOf(round.map((t) => t.outboundWeekday)), commonReturn: modeOf(round.map((t) => t.returnWeekday)),
    businessPct: round.length ? Math.round((business / round.length) * 100) : 0,
    nightsByYear: [...byYear.entries()].map(([year, nights]) => ({ year, nights })).sort((a, b) => a.year - b.year),
  }
}
