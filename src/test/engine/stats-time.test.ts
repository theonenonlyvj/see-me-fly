import { describe, it, expect } from 'vitest'
import { parseFlightyCsv } from '../../engine/parse'
import { enrichFlight } from '../../engine/enrich'
import { DEFAULT_DURATION_CONSTANTS } from '../../engine/constants'
import { REQUIRED_COLUMNS } from '../../engine/parse'
import { byWeekday, weekdayMonFirst, homeDistanceTiers, aircraftClassCounts, airlineByYear } from '../../engine/stats'
import type { Settings } from '../../engine'

const C = DEFAULT_DURATION_CONSTANTS
const H = REQUIRED_COLUMNS.join(',')
const mk = (line: string) => enrichFlight(parseFlightyCsv([H, line].join('\n')).rows[0], '2026-06-25', C)
// date, airline(ICAO), flightnum, from, to, ... aircraft type at col 19
const row = (date: string, from: string, to: string, airline = 'AAL', ac = 'Boeing 737-800') =>
  mk(`${date},${airline},1,${from},${to},,,,,false,,${date}T09:00,,,,,,,,${ac},,,,,,,,,,,`)

const S = (over: Partial<Settings> = {}): Settings => ({
  groupAirports: false, explicitlyUnique: false, includeCanceled: false, excludeBeforeDate: null, home: 'DFW', excludeHomeFromRankings: false, layoverMaxHours: 5, excludeDayTrips: true, splitCountriesByState: [], distanceEdges: [300, 700, 1500, 3000, 6000], duration: C, ...over,
})

describe('time/behavioral aggregators', () => {
  it('weekdayMonFirst maps dates to Mon-first index', () => {
    expect(weekdayMonFirst('2018-01-01')).toBe(0) // 2018-01-01 was a Monday
    expect(weekdayMonFirst('2018-01-06')).toBe(5) // Saturday
    expect(weekdayMonFirst('2018-01-07')).toBe(6) // Sunday
    expect(weekdayMonFirst('garbage')).toBe(null)
  })

  it('byWeekday tallies flights into 7 Mon-first buckets', () => {
    const res = byWeekday([row('2018-01-01', 'DFW', 'AUS'), row('2018-01-01', 'AUS', 'DFW'), row('2018-01-06', 'DFW', 'LAX')])
    expect(res.length).toBe(7)
    expect(res[0]).toBe(2) // Monday
    expect(res[5]).toBe(1) // Saturday
    expect(res[6]).toBe(0) // Sunday
  })

  it('homeDistanceTiers splits resolved flights into 4 closest→farthest tiers', () => {
    const res = homeDistanceTiers([row('2018-01-01', 'DFW', 'AUS'), row('2018-02-01', 'DFW', 'LHR')], S())
    const m = Object.fromEntries(res.map((r) => [r.tier, r.count]))
    expect(m['intra-state']).toBe(1) // DFW→AUS both Texas
    expect(m['intercontinental']).toBe(1) // DFW→LHR crosses continents
    expect(res.map((r) => r.tier)).toEqual(['intra-state', 'intra-country', 'intra-continent', 'intercontinental'])
  })

  it('aircraftClassCounts groups by body class in wide→prop order', () => {
    const res = aircraftClassCounts([row('2018-01-01', 'DFW', 'AUS', 'AAL', 'Boeing 737-800'), row('2018-02-01', 'DFW', 'LHR', 'AAL', 'Boeing 777-300'), row('2018-03-01', 'DFW', 'ORD', 'AAL', 'Bombardier CRJ700')])
    const m = Object.fromEntries(res.map((r) => [r.cls, r.count]))
    expect(m['narrow']).toBe(1)
    expect(m['wide']).toBe(1)
    expect(m['regional']).toBe(1)
    // wide listed before narrow before regional
    expect(res.findIndex((r) => r.cls === 'wide')).toBeLessThan(res.findIndex((r) => r.cls === 'narrow'))
  })

  it('airlineByYear stacks top-N airlines + Other across years', () => {
    const flights = [
      row('2018-01-01', 'DFW', 'AUS', 'AAL'), row('2018-02-01', 'DFW', 'HOU', 'AAL'),
      row('2018-03-01', 'DAL', 'HOU', 'SWA'),
      row('2019-01-01', 'DFW', 'ORD', 'UAL'), // Other
    ]
    const { years, series } = airlineByYear(flights, 2)
    expect(years).toEqual([2018, 2019])
    const names = series.map((s) => s.name)
    expect(names).toContain('American Airlines')
    expect(names).toContain('Southwest Airlines')
    expect(names[names.length - 1]).toBe('Other')
    const aa = series.find((s) => s.name === 'American Airlines')!
    expect(aa.counts).toEqual([2, 0])
    const other = series.find((s) => s.name === 'Other')!
    expect(other.counts).toEqual([0, 1]) // UAL in 2019
  })
})
