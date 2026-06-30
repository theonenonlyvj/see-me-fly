import { describe, it, expect } from 'vitest'
import { homeAt, hasHome, homeKeys, homePrimaryKeys, isHomeOn } from '../../engine/home'
import { airportKey } from '../../engine/normalize'
import { DEFAULT_DURATION_CONSTANTS as C } from '../../engine/constants'
import type { Settings, HomeEra } from '../../engine/types'

const S = (over: Partial<Settings> = {}): Settings => ({
  groupAirports: false, explicitlyUnique: false, includeCanceled: false, excludeBeforeDate: null, home: null, homeHistory: [], groundLinks: [], excludeHomeFromRankings: false, layoverMaxHours: 5, excludeDayTrips: true, splitCountriesByState: [], distanceEdges: [300, 700, 1500, 3000, 6000], mergeDefunctAirlines: false, duration: C, ...over,
})

// Canonical multi-era timeline used across most cases.
const ERAS: HomeEra[] = [
  { start: '2008-08-18', airports: ['RDU'], label: 'College — Durham' },
  { start: '2019-06-01', airports: ['DEN', 'SEA', 'PAE'], label: 'Moved to Denver' },
  { start: '2021-02-04', airports: ['DFW', 'DAL'], label: 'Back to Dallas' },
]

describe('hasHome', () => {
  it('true when homeHistory is non-empty', () => {
    expect(hasHome(S({ homeHistory: ERAS }))).toBe(true)
  })

  it('true when only the single home is set', () => {
    expect(hasHome(S({ home: 'DFW' }))).toBe(true)
  })

  it('false when no home info at all', () => {
    expect(hasHome(S({ home: null, homeHistory: [] }))).toBe(false)
  })
})

describe('homeAt — empty-history fallback to single home', () => {
  it('resolves the single home as a one-airport era', () => {
    const r = homeAt('2020-01-01', S({ home: 'DFW' }))
    expect(r).toEqual({ airports: ['DFW'], primary: 'DFW' })
  })
})

describe('homeAt — no home at all', () => {
  it('returns null when !hasHome', () => {
    expect(homeAt('2020-01-01', S({ home: null, homeHistory: [] }))).toBeNull()
  })
})

describe('homeAt — multi-era resolution', () => {
  const s = S({ homeHistory: ERAS })

  it('resolves a date inside the first era to RDU', () => {
    expect(homeAt('2010-06-01', s)!.primary).toBe('RDU')
  })

  it('move day resolves to the NEW era (half-open [start, nextStart))', () => {
    const r = homeAt('2019-06-01', s)!
    expect(r.primary).toBe('DEN')
    expect(r.airports).toEqual(['DEN', 'SEA', 'PAE'])
  })

  it('a recent date resolves to the last era (DFW)', () => {
    expect(homeAt('2025-01-01', s)!.primary).toBe('DFW')
  })
})

describe('homeAt — pre-first-era clamp (totality)', () => {
  it('a date before the first era clamps to the earliest era, not null', () => {
    const r = homeAt('2006-01-01', S({ homeHistory: ERAS }))
    expect(r).not.toBeNull()
    expect(r!.primary).toBe('RDU')
  })
})

describe('isHomeOn — boundary membership (move day, both sides count)', () => {
  const s = S({ homeHistory: ERAS })

  it('the OLD home counts as home on the move date', () => {
    expect(isHomeOn('RDU', '2019-06-01', s)).toBe(true)
  })

  it('the NEW home counts as home on the move date', () => {
    expect(isHomeOn('DEN', '2019-06-01', s)).toBe(true)
  })

  it('a non-home code is not home on the move date', () => {
    expect(isHomeOn('JFK', '2019-06-01', s)).toBe(false)
  })

  it('off the boundary, only the containing era counts', () => {
    // 2019-08-01 is inside the DEN era; RDU (prior era) must NOT count.
    expect(isHomeOn('RDU', '2019-08-01', s)).toBe(false)
    expect(isHomeOn('DEN', '2019-08-01', s)).toBe(true)
  })
})

describe('isHomeOn — grouping (SEA/PAE co-home via airportKey)', () => {
  it('with grouping ON, PAE is home during the Seattle/Denver era', () => {
    const s = S({ homeHistory: ERAS, groupAirports: true })
    expect(isHomeOn('PAE', '2019-08-01', s)).toBe(true)
    expect(isHomeOn('SEA', '2019-08-01', s)).toBe(true)
  })

  it('with grouping ON, DAL is home during the Dallas era (DFW/DAL group)', () => {
    const s = S({ homeHistory: ERAS, groupAirports: true })
    expect(isHomeOn('DAL', '2025-01-01', s)).toBe(true)
  })
})

describe('homeKeys — date-less union + most-recent primary', () => {
  it('keys contains the airportKey of every era airport; primaryKey = most-recent era primary key', () => {
    const s = S({ homeHistory: ERAS, groupAirports: true })
    const { keys, primaryKey } = homeKeys(s)
    expect(keys.has(airportKey('RDU', true))).toBe(true)
    expect(keys.has(airportKey('DEN', true))).toBe(true)
    expect(keys.has(airportKey('SEA', true))).toBe(true) // == airportKey('PAE', true) == 'Seattle'
    expect(keys.has(airportKey('DFW', true))).toBe(true) // == airportKey('DAL', true) == 'Dallas'
    expect(primaryKey).toBe(airportKey('DFW', true))
  })

  it('falls back to the single home when homeHistory is empty', () => {
    const s = S({ home: 'DFW' })
    const { keys, primaryKey } = homeKeys(s)
    expect(keys.has(airportKey('DFW', false))).toBe(true)
    expect(primaryKey).toBe(airportKey('DFW', false))
  })

  it('returns an empty set and null primary when !hasHome', () => {
    const { keys, primaryKey } = homeKeys(S())
    expect(keys.size).toBe(0)
    expect(primaryKey).toBeNull()
  })
})

describe('homePrimaryKeys — displayed bases (primaries only, no co-home secondaries)', () => {
  it('keys are the DISTINCT primary metros only; SEA/PAE (co-home) do NOT appear as bases', () => {
    const s = S({ homeHistory: ERAS, groupAirports: true })
    const { keys, currentKey } = homePrimaryKeys(s)
    expect(keys.has(airportKey('RDU', true))).toBe(true)
    expect(keys.has(airportKey('DEN', true))).toBe(true)   // Denver primary
    expect(keys.has(airportKey('DFW', true))).toBe(true)    // Dallas primary
    // Seattle (SEA/PAE) is a co-home SECONDARY of the Denver era — membership-only, never a base.
    expect(keys.has(airportKey('SEA', true))).toBe(false)
    expect(keys.has(airportKey('PAE', true))).toBe(false)
    expect(keys.size).toBe(3)
    expect(currentKey).toBe(airportKey('DFW', true))
  })

  it('contrast: homeKeys (membership union) DOES include Seattle, homePrimaryKeys does NOT', () => {
    const s = S({ homeHistory: ERAS, groupAirports: true })
    expect(homeKeys(s).keys.has(airportKey('SEA', true))).toBe(true)
    expect(homePrimaryKeys(s).keys.has(airportKey('SEA', true))).toBe(false)
  })

  it('falls back to the single home when homeHistory is empty', () => {
    const s = S({ home: 'DFW' })
    const { keys, currentKey } = homePrimaryKeys(s)
    expect(keys.has(airportKey('DFW', false))).toBe(true)
    expect(keys.size).toBe(1)
    expect(currentKey).toBe(airportKey('DFW', false))
  })

  it('returns an empty set and null currentKey when !hasHome', () => {
    const { keys, currentKey } = homePrimaryKeys(S())
    expect(keys.size).toBe(0)
    expect(currentKey).toBeNull()
  })
})
