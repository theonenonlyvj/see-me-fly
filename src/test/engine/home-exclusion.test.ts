import { describe, it, expect } from 'vitest'
import { byCountry, domesticTierOf } from '../../engine/stats'
import { byAirport } from '../../engine/aggregate'
import { enrichFlight } from '../../engine/enrich'
import { parseFlightyCsv, REQUIRED_COLUMNS } from '../../engine/parse'
import { DEFAULT_DURATION_CONSTANTS as C } from '../../engine/constants'
import type { Settings, HomeEra } from '../../engine/types'

const H = REQUIRED_COLUMNS.join(',')
const TODAY = '2026-06-29'
const mk = (line: string) => enrichFlight(parseFlightyCsv([H, line].join('\n')).rows[0], TODAY, C)
const route = (from: string, to: string, date = '2018-01-01') =>
  mk(`${date},AAL,1,${from},${to},,,,,false,,${date}T09:00,,,,,,,,Boeing 737,,,,,,,,,,,`)

const S = (over: Partial<Settings> = {}): Settings => ({
  groupAirports: false, explicitlyUnique: false, includeCanceled: false, excludeBeforeDate: null,
  home: null, homeHistory: [], groundLinks: [], excludeHomeFromRankings: true, layoverMaxHours: 5,
  excludeDayTrips: true, splitCountriesByState: [], distanceEdges: [300, 700, 1500, 3000, 6000],
  mergeDefunctAirlines: false, duration: C, ...over,
})

// Sample multi-era timeline: a college home → a relocation → a later move.
const ERAS: HomeEra[] = [
  { start: '2008-08-18', airports: ['RDU'] },
  { start: '2012-07-03', airports: ['MKE', 'ORD', 'MDW'] },
  { start: '2013-01-15', airports: ['DFW', 'DAL'] },
]

// Helpers to read a country / region count out of a byCountry result.
const usRegions = (res: ReturnType<typeof byCountry>) =>
  res.find((r) => r.code === 'US')?.regions ?? []
const regionCount = (res: ReturnType<typeof byCountry>, region: string) =>
  usRegions(res).find((r) => r.region === region)?.count ?? 0

describe('byCountry — date-aware home exclusion', () => {
  it('DFW→ORD in 2012 (ORD home) credits Texas, not Illinois', () => {
    const s = S({ homeHistory: ERAS })
    const res = byCountry([route('DFW', 'ORD', '2012-09-01')], s)
    expect(regionCount(res, 'US-TX')).toBe(1) // DFW credited
    expect(regionCount(res, 'US-IL')).toBe(0) // ORD was home → skipped
  })

  it('the SAME route in 2020 (DFW home) credits Illinois, not Texas', () => {
    const s = S({ homeHistory: ERAS })
    const res = byCountry([route('DFW', 'ORD', '2020-09-01')], s)
    expect(regionCount(res, 'US-IL')).toBe(1) // ORD credited
    expect(regionCount(res, 'US-TX')).toBe(0) // DFW was home → skipped
  })

  it('only the date-correct endpoint is excluded across both eras combined', () => {
    const s = S({ homeHistory: ERAS })
    const res = byCountry([
      route('DFW', 'ORD', '2012-09-01'), // ORD home → Texas credited
      route('DFW', 'ORD', '2020-09-01'), // DFW home → Illinois credited
    ], s)
    expect(regionCount(res, 'US-TX')).toBe(1)
    expect(regionCount(res, 'US-IL')).toBe(1)
  })

  it('with exclusion off, both endpoints are always credited', () => {
    const s = S({ homeHistory: ERAS, excludeHomeFromRankings: false })
    const res = byCountry([route('DFW', 'ORD', '2012-09-01')], s)
    expect(regionCount(res, 'US-TX')).toBe(1)
    expect(regionCount(res, 'US-IL')).toBe(1)
  })

  it('single-home fallback still excludes the legacy home all-time', () => {
    const s = S({ home: 'DFW' })
    const res = byCountry([route('DFW', 'ORD', '2020-09-01')], s)
    expect(regionCount(res, 'US-TX')).toBe(0) // DFW home all-time → skipped
    expect(regionCount(res, 'US-IL')).toBe(1)
  })
})

describe('domesticTierOf — date-aware intra-state', () => {
  it('DFW→AUS in 2012 with MKE-era home is intra-country, not intra-state', () => {
    const s = S({ homeHistory: ERAS })
    // 2012-09-01 falls in the MKE/Wisconsin era; the route is in Texas (US-TX) → not home state.
    expect(domesticTierOf(route('DFW', 'AUS', '2012-09-01'), s)).toBe('intra-country')
  })

  it('DFW→AUS in 2020 with DFW-era home is intra-state', () => {
    const s = S({ homeHistory: ERAS })
    expect(domesticTierOf(route('DFW', 'AUS', '2020-09-01'), s)).toBe('intra-state')
  })

  it('single-home fallback: DFW home keeps DFW→AUS intra-state', () => {
    const s = S({ home: 'DFW' })
    expect(domesticTierOf(route('DFW', 'AUS', '2020-09-01'), s)).toBe('intra-state')
  })

  it('no home at all: an in-state route stays intra-state (no home-relative narrowing)', () => {
    const s = S({ home: null, homeHistory: [] })
    expect(domesticTierOf(route('DFW', 'AUS', '2020-09-01'), s)).toBe('intra-state')
  })
})

describe('byAirport — date-aware home exclusion', () => {
  const find = (res: { key: string; count: number }[], key: string) =>
    res.find((r) => r.key === key)?.count ?? 0

  it('excludes RDU only for college-era flights; counts it in later years', () => {
    const s = S({ homeHistory: ERAS })
    const res = byAirport([
      route('RDU', 'DFW', '2010-03-01'), // RDU home era → RDU dropped
      route('RDU', 'DFW', '2020-03-01'), // RDU just a visited airport → counts
    ], s)
    expect(find(res, 'RDU')).toBe(1) // only the 2020 flight credits RDU
    expect(find(res, 'DFW')).toBe(1) // 2010 DFW (not home then) + 2020 DFW (home → dropped) = 1
  })

  it('with exclusion off, RDU counts in every year', () => {
    const s = S({ homeHistory: ERAS, excludeHomeFromRankings: false })
    const res = byAirport([
      route('RDU', 'DFW', '2010-03-01'),
      route('RDU', 'DFW', '2020-03-01'),
    ], s)
    expect(find(res, 'RDU')).toBe(2)
  })

  it('single-home fallback excludes the legacy home all-time', () => {
    const s = S({ home: 'DFW' })
    const res = byAirport([route('DFW', 'AUS', '2020-01-01')], s)
    expect(find(res, 'DFW')).toBe(0) // home excluded
    expect(find(res, 'AUS')).toBe(1)
  })

  it('no home: nothing is excluded', () => {
    const s = S({ home: null, homeHistory: [] })
    const res = byAirport([route('DFW', 'AUS', '2020-01-01')], s)
    expect(find(res, 'DFW')).toBe(1)
    expect(find(res, 'AUS')).toBe(1)
  })
})
