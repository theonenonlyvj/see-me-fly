import { describe, it, expect } from 'vitest'
import { parseFlightyCsv } from '../../engine/parse'
import { enrichFlight } from '../../engine/enrich'
import { DEFAULT_DURATION_CONSTANTS } from '../../engine/constants'
import { REQUIRED_COLUMNS } from '../../engine/parse'
import { byWeekday, weekdayMonFirst, homeDistanceTiers, aircraftClassCounts, airlineByYear, redEyeProfile, fleetStats, ghostAirlines, reconstructTrips, tripSummary } from '../../engine/stats'
import type { Settings } from '../../engine'

const C = DEFAULT_DURATION_CONSTANTS
const H = REQUIRED_COLUMNS.join(',')
const mk = (line: string) => enrichFlight(parseFlightyCsv([H, line].join('\n')).rows[0], '2026-06-25', C)
// date, airline(ICAO), flightnum, from, to, ... aircraft type at col 19
const row = (date: string, from: string, to: string, airline = 'AAL', ac = 'Boeing 737-800') =>
  mk(`${date},${airline},1,${from},${to},,,,,false,,${date}T09:00,,,,,,,,${ac},,,,,,,,,,,`)
// row with explicit local departure time + tail
const rowT = (date: string, time: string, tail: string, airline = 'AAL') =>
  mk(`${date},${airline},1,DFW,AUS,,,,,false,,${date}T${time},,,,,,,,Boeing 737-800,${tail},,,,,,,,,,,,`)

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

  it('redEyeProfile counts late-night and dawn departures by local hour', () => {
    const res = redEyeProfile([rowT('2018-01-01', '23:30', 'N1'), rowT('2018-01-02', '02:00', 'N2'), rowT('2018-01-03', '05:30', 'N3'), rowT('2018-01-04', '09:00', 'N4')])
    expect(res.withTime).toBe(4)
    expect(res.redEyes).toBe(2)    // 23:00 and 02:00
    expect(res.dawnPatrol).toBe(1) // 05:30
    expect(res.hourCounts[23]).toBe(1)
  })

  it('fleetStats counts airframes, one-timers, and the most-ridden tail', () => {
    const res = fleetStats([rowT('2018-01-01', '09:00', 'N100'), rowT('2018-02-01', '09:00', 'N100'), rowT('2018-03-01', '09:00', 'N200')])
    expect(res.distinctTails).toBe(2)
    expect(res.withTail).toBe(3)
    expect(res.oneTimers).toBe(1)
    expect(res.mostRepeated).toMatchObject({ tail: 'N100', count: 2 })
  })

  it('ghostAirlines surfaces defunct carriers with count + last flown', () => {
    const res = ghostAirlines([row('2014-01-01', 'DFW', 'PHX', 'AWE'), row('2015-01-01', 'DFW', 'PHX', 'AWE'), row('2018-01-01', 'DFW', 'AUS', 'AAL')])
    expect(res.length).toBe(1)
    expect(res[0]).toMatchObject({ code: 'AWE', count: 2, last: '2015-01-01' })
    expect(res[0].fate).toMatch(/American/)
  })

  it('reconstructTrips groups legs into home-anchored trips', () => {
    const flights = [
      row('2018-01-02', 'DFW', 'ORD'), row('2018-01-04', 'ORD', 'DFW'), // round trip, 2 nights, Tue→Thu
      row('2018-02-01', 'DFW', 'AUS'), row('2018-02-01', 'AUS', 'DFW'), // day trip, 0 nights
      row('2018-03-01', 'DFW', 'LHR'),                                   // open (no return)
    ]
    const trips = reconstructTrips(flights, S({ home: 'DFW' }))
    expect(trips.length).toBe(3)
    expect(trips[0]).toMatchObject({ nights: 2, roundTrip: true, outboundWeekday: 1, returnWeekday: 3 }) // Tue→Thu
    expect(trips[1]).toMatchObject({ nights: 0, roundTrip: true })
    expect(trips[2].roundTrip).toBe(false) // open trip to London
    expect(reconstructTrips(flights, S({ home: null }))).toEqual([]) // no home → no trips
  })

  it('tripSummary rolls up cadence + nights-away', () => {
    const flights = [
      row('2018-01-02', 'DFW', 'ORD'), row('2018-01-04', 'ORD', 'DFW'), // 2 nights, business shape
      row('2019-01-01', 'DFW', 'AUS'), row('2019-01-03', 'AUS', 'DFW'), // 2 nights
    ]
    const s = tripSummary(reconstructTrips(flights, S({ home: 'DFW' })))
    expect(s.tripCount).toBe(2)
    expect(s.roundTrips).toBe(2)
    expect(s.totalNights).toBe(4)
    expect(s.medianNights).toBe(2)
    expect(s.commonOutbound).not.toBeNull()
    expect(s.nightsByYear).toEqual([{ year: 2018, nights: 2 }, { year: 2019, nights: 2 }])
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
