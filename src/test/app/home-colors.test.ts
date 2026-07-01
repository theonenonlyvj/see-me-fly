import { describe, it, expect } from 'vitest'
import { buildHomeColoring, HOME_COLOR_ORDER, NEUTRAL_HOME_COLOR } from '../../app/lib/home-colors'
import type { Settings } from '../../engine'

const S = (over: Partial<Settings> = {}): Settings => ({
  groupAirports: false, explicitlyUnique: false, includeCanceled: false, excludeBeforeDate: null,
  home: null, homeHistory: [], groundLinks: [], excludeHomeFromRankings: false, layoverMaxHours: 5,
  excludeDayTrips: true, splitCountriesByState: [], distanceEdges: [300, 700, 1500, 3000, 6000],
  mergeDefunctAirlines: false,
  duration: { cruiseMph: 500, taxiMin: 15, climbDescentMin: 10, gateTaxiMin: 10, localFlightDefaultMin: 30, localFlightMinMin: 10 },
  ...over,
})

describe('buildHomeColoring', () => {
  it('assigns palette colors in chronological era order (coral then indigo)', () => {
    const c = buildHomeColoring(S({
      homeHistory: [
        { start: '2013-01-01', airports: ['DEN'] },
        { start: '2015-01-01', airports: ['DFW'] },
      ],
    }))
    expect(c.hasHomes).toBe(true)
    // Denver era (first) → coral; DFW era (second) → indigo.
    expect(c.colorFor('2014-06-01')).toBe(HOME_COLOR_ORDER[0]) // DEN
    expect(c.colorFor('2019-06-01')).toBe(HOME_COLOR_ORDER[1]) // DFW
    expect(c.legend).toEqual([
      { label: expect.stringContaining('DEN'), color: HOME_COLOR_ORDER[0] },
      { label: expect.stringContaining('DFW'), color: HOME_COLOR_ORDER[1] },
    ])
  })

  it('a repeated metro reuses its first-assigned color (no new slot)', () => {
    const c = buildHomeColoring(S({
      homeHistory: [
        { start: '2013-01-01', airports: ['DFW'] },
        { start: '2016-01-01', airports: ['DEN'] },
        { start: '2019-01-01', airports: ['DFW'] }, // back to Dallas
      ],
    }))
    // Only two distinct metros → two legend rows.
    expect(c.legend.length).toBe(2)
    expect(c.colorFor('2014-06-01')).toBe(HOME_COLOR_ORDER[0]) // DFW
    expect(c.colorFor('2020-06-01')).toBe(HOME_COLOR_ORDER[0]) // DFW again → same color
    expect(c.colorFor('2017-06-01')).toBe(HOME_COLOR_ORDER[1]) // DEN
  })

  it('falls back to the single home when there is no timeline', () => {
    const c = buildHomeColoring(S({ home: 'DFW' }))
    expect(c.hasHomes).toBe(true)
    expect(c.legend.length).toBe(1)
    expect(c.colorFor('2020-06-01')).toBe(HOME_COLOR_ORDER[0])
  })

  it('no home → neutral color for every date and an empty legend', () => {
    const c = buildHomeColoring(S({ home: null, homeHistory: [] }))
    expect(c.hasHomes).toBe(false)
    expect(c.legend).toEqual([])
    expect(c.colorFor('2020-06-01')).toBe(NEUTRAL_HOME_COLOR)
  })
})
