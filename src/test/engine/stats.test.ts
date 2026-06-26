import { describe, it, expect } from 'vitest'
import { byCountry, superDomestic, intercontinental } from '../../engine/stats'
import { enrichFlight } from '../../engine/enrich'
import { parseFlightyCsv, REQUIRED_COLUMNS } from '../../engine/parse'
import { DEFAULT_DURATION_CONSTANTS as C } from '../../engine/constants'
import type { Settings } from '../../engine/types'

const H = REQUIRED_COLUMNS.join(',')
const TODAY = '2026-06-25'
const mk = (line: string) => enrichFlight(parseFlightyCsv([H, line].join('\n')).rows[0], TODAY, C)
const route = (from: string, to: string, date = '2018-01-01') =>
  mk(`${date},AAL,1,${from},${to},,,,,false,,${date}T09:00,,,,,,,,Boeing 737,,,,,,,,,,,`)

const S = (over: Partial<Settings> = {}): Settings => ({
  groupAirports: false, explicitlyUnique: false, includeCanceled: false, excludeBeforeDate: null, duration: C, ...over,
})

// 3-flight fixture:
// DFW→AUS  — intra-state  (US/NA)
// DFW→LHR  — intercontinental NA↔EU
// HNL→DFW  — intercontinental OC↔NA
const flights = [
  route('DFW', 'AUS'),  // US-TX → US-TX, intra-state
  route('DFW', 'LHR'),  // US (NA) → GB (EU), intercontinental
  route('HNL', 'DFW'),  // US (OC) → US (NA), intercontinental
]

describe('byCountry', () => {
  it('US appears with count 3 (all 3 flights touch US)', () => {
    const result = byCountry(flights, S())
    const us = result.find((r) => r.code === 'US')
    expect(us).toBeDefined()
    expect(us!.count).toBe(3)
  })

  it('GB appears with count 1', () => {
    const result = byCountry(flights, S())
    const gb = result.find((r) => r.code === 'GB')
    expect(gb).toBeDefined()
    expect(gb!.count).toBe(1)
  })

  it('countries sorted desc by count', () => {
    const result = byCountry(flights, S())
    expect(result[0].code).toBe('US')
    for (let i = 1; i < result.length; i++) {
      expect(result[i].count).toBeLessThanOrEqual(result[i - 1].count)
    }
  })

  it('US has non-empty flag emoji', () => {
    const result = byCountry(flights, S())
    const us = result.find((r) => r.code === 'US')!
    expect(us.flag).toBeTruthy()
    expect(us.flag.length).toBeGreaterThan(0)
  })

  it('GB has non-empty flag emoji', () => {
    const result = byCountry(flights, S())
    const gb = result.find((r) => r.code === 'GB')!
    expect(gb.flag).toBeTruthy()
  })

  it('US has name resolved', () => {
    const result = byCountry(flights, S())
    const us = result.find((r) => r.code === 'US')!
    expect(us.name).toBeTruthy()
    expect(us.name).not.toBe('US') // should resolve to a country name
  })

  it('US has regions populated with US-TX', () => {
    const result = byCountry(flights, S())
    const us = result.find((r) => r.code === 'US')!
    expect(us.regions).toBeDefined()
    expect(us.regions!.length).toBeGreaterThan(0)
    const tx = us.regions!.find((r) => r.region === 'US-TX')
    expect(tx).toBeDefined()
    expect(tx!.count).toBeGreaterThan(0)
  })

  it('GB does not have regions populated', () => {
    const result = byCountry(flights, S())
    const gb = result.find((r) => r.code === 'GB')!
    expect(gb.regions).toBeUndefined()
  })

  it('each flight credits each distinct country only once', () => {
    // DFW→LHR credits US once and GB once (not twice for DFW appearing in 2 flights)
    // But total US count = 3 (3 flights each touch US at least once)
    const result = byCountry(flights, S())
    const us = result.find((r) => r.code === 'US')!
    expect(us.count).toBe(3)
    const gb = result.find((r) => r.code === 'GB')!
    expect(gb.count).toBe(1)
  })

  it('US regions sorted desc by count', () => {
    const result = byCountry(flights, S())
    const us = result.find((r) => r.code === 'US')!
    if (us.regions && us.regions.length > 1) {
      for (let i = 1; i < us.regions.length; i++) {
        expect(us.regions[i].count).toBeLessThanOrEqual(us.regions[i - 1].count)
      }
    }
  })
})

describe('superDomestic', () => {
  it('includes intra-state tier', () => {
    const result = superDomestic(flights, S())
    const tiers = result.map((t) => t.tier)
    expect(tiers).toContain('intra-state')
  })

  it('does not include intercontinental tier', () => {
    const result = superDomestic(flights, S())
    const tiers = result.map((t) => t.tier)
    expect(tiers).not.toContain('intercontinental')
  })

  it('intra-state tier contains DFW↔AUS route', () => {
    const result = superDomestic(flights, S())
    const intraState = result.find((t) => t.tier === 'intra-state')!
    expect(intraState).toBeDefined()
    expect(intraState.routes.length).toBeGreaterThan(0)
    const routeKeys = intraState.routes.map((r) => r.key)
    // undirected: AUS↔DFW
    const hasDfwAus = routeKeys.some((k) => k.includes('DFW') && k.includes('AUS'))
    expect(hasDfwAus).toBe(true)
  })

  it('intra-state routes have count >= 1', () => {
    const result = superDomestic(flights, S())
    const intraState = result.find((t) => t.tier === 'intra-state')
    if (intraState) {
      for (const r of intraState.routes) {
        expect(r.count).toBeGreaterThanOrEqual(1)
      }
    }
  })

  it('tiers appear in order intra-state, intra-country, intra-continent', () => {
    const tierOrder = ['intra-state', 'intra-country', 'intra-continent']
    const result = superDomestic(flights, S())
    const resultTiers = result.map((t) => t.tier)
    const positions = resultTiers.map((t) => tierOrder.indexOf(t))
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]).toBeGreaterThan(positions[i - 1])
    }
  })

  it('returns only tiers with routes', () => {
    // All 3 flights are either intra-state or intercontinental, no intra-country/continent
    const result = superDomestic(flights, S())
    for (const t of result) {
      expect(t.routes.length).toBeGreaterThan(0)
    }
  })
})

describe('intercontinental', () => {
  it('returns 2 routes for 2 intercontinental flights', () => {
    const result = intercontinental(flights, S())
    expect(result.length).toBe(2)
  })

  it('contains a route with London (LHR)', () => {
    const result = intercontinental(flights, S())
    const hasLhr = result.some((r) => r.key.includes('LHR'))
    expect(hasLhr).toBe(true)
  })

  it('contains a route with Honolulu (HNL)', () => {
    const result = intercontinental(flights, S())
    const hasHnl = result.some((r) => r.key.includes('HNL'))
    expect(hasHnl).toBe(true)
  })

  it('routes have count >= 1', () => {
    const result = intercontinental(flights, S())
    for (const r of result) {
      expect(r.count).toBeGreaterThanOrEqual(1)
    }
  })

  it('routes have miles > 0', () => {
    const result = intercontinental(flights, S())
    for (const r of result) {
      expect(r.miles).toBeGreaterThan(0)
    }
  })

  it('sorted desc by count', () => {
    const moreFlights = [
      ...flights,
      route('DFW', 'LHR'), // second DFW↔LHR flight
    ]
    const result = intercontinental(moreFlights, S())
    expect(result[0].key).toContain('LHR')
    expect(result[0].count).toBe(2)
  })

  it('does not include intra-state routes', () => {
    const result = intercontinental(flights, S())
    const hasDfwAus = result.some((r) => r.key.includes('AUS'))
    expect(hasDfwAus).toBe(false)
  })
})

describe('flagEmoji helper (via byCountry)', () => {
  it('produces regional indicator pairs for 2-letter codes', () => {
    const result = byCountry(flights, S())
    // US flag: 🇺🇸 is two chars (regional indicator S + regional indicator U)
    const us = result.find((r) => r.code === 'US')!
    // Regional indicators are encoded as surrogate pairs; each is 2 code units in JS strings
    // 2 regional indicators = 4 code units
    expect(us.flag.length).toBe(4) // 2 regional indicators, each 2 UTF-16 code units
  })
})
