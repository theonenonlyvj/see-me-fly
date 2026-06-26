import type { EnrichedFlight, Settings } from './types'
import { classifyRoute } from './classify'
import { routeKey } from './normalize'
import { countryName, regionName } from './reference'

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
