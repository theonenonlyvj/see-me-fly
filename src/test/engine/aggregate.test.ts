import { describe, it, expect } from 'vitest'
import { applyFilters } from '../../engine/filter'
import { byAirport, byRoute, byAirline, distanceBuckets, distanceBucketsFor, sanitizeEdges, DEFAULT_DISTANCE_EDGES, byYear, milestones, totals } from '../../engine/aggregate'
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
  groupAirports: false, explicitlyUnique: true, includeCanceled: false, excludeBeforeDate: null, home: null, homeHistory: [], groundLinks: [], excludeHomeFromRankings: false, layoverMaxHours: 5, excludeDayTrips: true, splitCountriesByState: [], distanceEdges: [300, 700, 1500, 3000, 6000], mergeDefunctAirlines: false, duration: C, ...over,
})

describe('filter', () => {
  it('drops canceled by default but keeps when included', () => {
    const cx = mk('2018-01-01,AAL,1,DFW,AUS,,,,,true,,2018-01-01T09:00,,,,,,,,Boeing 737,,,,,,,,,,,')
    expect(applyFilters([cx], S(), TODAY)).toHaveLength(0)
    expect(applyFilters([cx], S({ includeCanceled: true }), TODAY)).toHaveLength(1)
  })
  it('drops future/upcoming flights', () => {
    const up = route('DFW', 'LAX', '2026-08-22')
    expect(applyFilters([up], S(), TODAY)).toHaveLength(0)
  })
  it('honors excludeBeforeDate', () => {
    expect(applyFilters([route('DFW', 'AUS', '2001-01-01')], S({ excludeBeforeDate: '2002-01-01' }), TODAY)).toHaveLength(0)
  })
})

describe('aggregate', () => {
  it('byAirport credits both endpoints and groups', () => {
    const res = byAirport([route('DFW', 'AUS'), route('DAL', 'AUS')], S({ groupAirports: true }))
    const dallas = res.find((r) => r.key === 'Dallas')!
    expect(dallas.count).toBe(2) // DFW + DAL collapse to Dallas
    expect(res.find((r) => r.key === 'AUS')!.count).toBe(2)
  })
  it('byRoute collapses with grouping+undirected', () => {
    const res = byRoute([route('DFW', 'SFO'), route('SFO', 'DFW')], S({ groupAirports: true, explicitlyUnique: false }))
    expect(res).toHaveLength(1)
    expect(res[0].count).toBe(2)
  })
  it('byAirline excludes Unknown', () => {
    const unknown = mk('2013-08-18,,,RPJ,RPJ,,,,,false,,2013-08-18T12:00,,,,,,2013-08-18T12:30,,DHC-6 Twin Otter,,,,,,,,,,,,')
    const res = byAirline([route('DFW', 'AUS'), unknown])
    expect(res.some((r) => r.name === 'Unknown airline')).toBe(false)
  })
  it('distanceBuckets bins by mileage', () => {
    const res = distanceBuckets([route('DFW', 'AUS'), route('DFW', 'LHR')]) // ~190mi, ~4700mi
    const short = res.find((b) => b.label.includes('<300'))!
    expect(short.count).toBe(1)
  })
  it('distanceBuckets matches the default edges exactly (back-compat labels)', () => {
    expect(distanceBuckets([]).map((b) => b.label)).toEqual([
      '<300 mi', '300–700 mi', '700–1,500 mi', '1,500–3,000 mi', '3,000–6,000 mi', '6,000+ mi',
    ])
    expect(DEFAULT_DISTANCE_EDGES).toEqual([300, 700, 1500, 3000, 6000])
  })
  it('distanceBucketsFor honors custom edges with lo/hi + thousands labels', () => {
    const res = distanceBucketsFor([route('DFW', 'AUS'), route('DFW', 'LHR')], [500, 5000]) // ~190, ~4700
    expect(res.map((b) => b.label)).toEqual(['<500 mi', '500–5,000 mi', '5,000+ mi'])
    expect(res[0].count).toBe(1) // 190 < 500
    expect(res[1].count).toBe(1) // 4700 in [500, 5000)
    expect(res[2].count).toBe(0)
    expect(res[0].lo).toBe(0)
    expect(res[2].lo).toBe(5000)
    expect(res[2].hi).toBe(Infinity)
  })
  it('sanitizeEdges drops invalid, sorts, dedupes, and falls back to default', () => {
    expect(sanitizeEdges([700, 300, 300, -5, 0, NaN])).toEqual([300, 700])
    expect(sanitizeEdges([])).toEqual(DEFAULT_DISTANCE_EDGES)
    expect(sanitizeEdges(undefined)).toEqual(DEFAULT_DISTANCE_EDGES)
  })
  it('totals uses undirected unique routes honoring the overview exception', () => {
    const t = totals([route('DFW', 'SFO'), route('SFO', 'DFW')], S({ explicitlyUnique: true }))
    expect(t.uniqueRoutes).toBe(1) // overview ignores direction
    expect(t.count).toBe(2)
  })
  it('byYear counts flights per year, descending', () => {
    const res = byYear([route('DFW', 'AUS', '2018-01-01'), route('DFW', 'ORD', '2018-06-01'), route('DFW', 'LAX', '2020-01-01')])
    expect(res[0]).toEqual({ year: 2020, count: 1 })
    expect(res.find((y) => y.year === 2018)!.count).toBe(2)
  })
})

describe('milestones', () => {
  it('orders by departure timestamp then rawIndex; works with blank Flighty ID', () => {
    const a = route('DFW', 'AUS', '2010-01-01')
    const b = route('DFW', 'ORD', '2012-01-01')
    const res = milestones([b, a], [1, 2]) // pass out of order; ordinals 1st & 2nd
    expect(res[0].flight.date).toBe('2010-01-01')
    expect(res[1].flight.date).toBe('2012-01-01')
  })
})
