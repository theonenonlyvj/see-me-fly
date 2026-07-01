import { describe, it, expect } from 'vitest'
import {
  homeAwayRibbon, tripTier, longestHomeStretch, longestAwayStint,
  type RibbonYear,
} from '../../engine/stats'
import type { Trip } from '../../engine/stats'
import type { EnrichedFlight, Settings, Continent } from '../../engine/types'
import { dayOfYear } from '../../app/lib/polar'

// ── Fixtures ─────────────────────────────────────────────────────────────────
// The ribbon helpers read from a Trip: departDate/returnDate/nights/year/estimated + each
// flight's from/to continent (for the tier). Build just those fields.

let seq = 0
const AP = (continent: Continent) => ({ continent }) as unknown as EnrichedFlight['from']
const FL = (fromC: Continent, toC: Continent): EnrichedFlight =>
  ({ id: `f${seq++}`, from: AP(fromC), to: AP(toC) } as unknown as EnrichedFlight)

const TRIP = (o: Partial<Trip> & Pick<Trip, 'departDate' | 'returnDate'>): Trip => {
  const nights = Math.max(0, Math.round(
    (Date.parse(o.returnDate) - Date.parse(o.departDate)) / 86_400_000,
  ))
  return {
    flights: o.flights ?? [FL('NA', 'NA')],
    departDate: o.departDate,
    returnDate: o.returnDate,
    nights: o.nights ?? nights,
    year: o.year ?? Number(o.departDate.slice(0, 4)),
    outboundWeekday: 0,
    returnWeekday: 0,
    roundTrip: o.roundTrip ?? true,
    destinations: o.destinations ?? [],
    ...(o.estimated ? { estimated: o.estimated } : {}),
  }
}

// Home is DFW (North America) → tier is relative to NA.
const S = (over: Partial<Settings> = {}): Settings => ({
  groupAirports: false, explicitlyUnique: false, includeCanceled: false, excludeBeforeDate: null,
  home: 'DFW', homeHistory: [], groundLinks: [], excludeHomeFromRankings: false, layoverMaxHours: 5,
  excludeDayTrips: true, splitCountriesByState: [], distanceEdges: [300, 700, 1500, 3000, 6000],
  mergeDefunctAirlines: false,
  duration: { cruiseMph: 500, taxiMin: 0, climbDescentMin: 0, gateTaxiMin: 0, localFlightDefaultMin: 30, localFlightMinMin: 10 },
  ...over,
})

const rowFor = (rows: RibbonYear[], y: number) => rows.find((r) => r.year === y)!

describe('tripTier', () => {
  it('a trip that never leaves the home continent is domestic', () => {
    const t = TRIP({ departDate: '2019-03-01', returnDate: '2019-03-05', flights: [FL('NA', 'NA'), FL('NA', 'NA')] })
    expect(tripTier(t, S())).toBe('domestic')
  })

  it('reaching Europe (EU) is transatlantic', () => {
    const t = TRIP({ departDate: '2019-07-01', returnDate: '2019-07-12', flights: [FL('NA', 'EU'), FL('EU', 'NA')] })
    expect(tripTier(t, S())).toBe('transatlantic')
  })

  it('reaching Asia (AS) is transpacific', () => {
    const t = TRIP({ departDate: '2018-09-13', returnDate: '2018-09-22', flights: [FL('NA', 'AS'), FL('AS', 'NA')] })
    expect(tripTier(t, S())).toBe('transpacific')
  })

  it('reaching Oceania (OC) is transpacific', () => {
    const t = TRIP({ departDate: '2023-11-01', returnDate: '2023-11-10', flights: [FL('NA', 'OC'), FL('OC', 'NA')] })
    expect(tripTier(t, S())).toBe('transpacific')
  })

  it('a trip touching both EU and AS is transpacific (Pacific tier wins)', () => {
    const t = TRIP({ departDate: '2019-06-01', returnDate: '2019-06-20', flights: [FL('NA', 'EU'), FL('EU', 'AS'), FL('AS', 'NA')] })
    expect(tripTier(t, S())).toBe('transpacific')
  })
})

describe('homeAwayRibbon', () => {
  it('places a domestic trip on its year row as lime away-days, rest home', () => {
    const t = TRIP({ departDate: '2019-03-01', returnDate: '2019-03-06' }) // 5 nights away
    const rows = homeAwayRibbon([t], S())
    expect(rows).toHaveLength(1)
    const r = rowFor(rows, 2019)
    expect(r.totalDays).toBe(365)
    expect(r.awayDays).toBe(5) // Mar 1..Mar 5 (return day is a home day)
    expect(r.spans).toHaveLength(1)
    expect(r.spans[0].tier).toBe('domestic')
    expect(r.spans[0].estimated).toBe(false)
    expect(r.spans[0].startDoy).toBe(dayOfYear('2019-03-01'))
    expect(r.spans[0].endDoy).toBe(dayOfYear('2019-03-05'))
  })

  it('marks an estimated-boundary trip span as estimated', () => {
    const t = TRIP({ departDate: '2020-05-01', returnDate: '2020-05-04', estimated: { boundary: 'end' } })
    const r = rowFor(homeAwayRibbon([t], S()), 2020)
    expect(r.spans[0].estimated).toBe(true)
    expect(r.totalDays).toBe(366) // 2020 is a leap year
  })

  it('splits a New-Year-crossing trip into one span per year row', () => {
    // Dec 28 2019 → Jan 5 2020: away Dec28..Jan4 (8 nights).
    const t = TRIP({ departDate: '2019-12-28', returnDate: '2020-01-05', flights: [FL('NA', 'EU'), FL('EU', 'NA')] })
    const rows = homeAwayRibbon([t], S())
    const y19 = rowFor(rows, 2019)
    const y20 = rowFor(rows, 2020)
    // 2019 row: Dec 28..31 (4 days), running to the last doy of 2019.
    expect(y19.spans).toHaveLength(1)
    expect(y19.spans[0].startDoy).toBe(dayOfYear('2019-12-28'))
    expect(y19.spans[0].endDoy).toBe(365)
    expect(y19.awayDays).toBe(4)
    // 2020 row: Jan 1..Jan 4 (4 days).
    expect(y20.spans).toHaveLength(1)
    expect(y20.spans[0].startDoy).toBe(1)
    expect(y20.spans[0].endDoy).toBe(dayOfYear('2020-01-04'))
    expect(y20.awayDays).toBe(4)
    // Both spans carry the trip's tier.
    expect(y19.spans[0].tier).toBe('transatlantic')
    expect(y20.spans[0].tier).toBe('transatlantic')
  })

  it('emits an all-home row for a gap year between trips', () => {
    const rows = homeAwayRibbon([
      TRIP({ departDate: '2017-04-01', returnDate: '2017-04-03' }),
      TRIP({ departDate: '2019-04-01', returnDate: '2019-04-03' }),
    ], S())
    expect(rows.map((r) => r.year)).toEqual([2017, 2018, 2019])
    const gap = rowFor(rows, 2018)
    expect(gap.awayDays).toBe(0)
    expect(gap.spans).toHaveLength(0)
  })

  it('does not double-count overlapping trips in awayDays', () => {
    const rows = homeAwayRibbon([
      TRIP({ departDate: '2019-06-01', returnDate: '2019-06-06' }), // 06-01..06-05
      TRIP({ departDate: '2019-06-03', returnDate: '2019-06-08' }), // 06-03..06-07
    ], S())
    const r = rowFor(rows, 2019)
    // Union of {06-01..06-05} and {06-03..06-07} = 06-01..06-07 = 7 distinct away days.
    expect(r.awayDays).toBe(7)
  })

  it('returns [] with no trips', () => {
    expect(homeAwayRibbon([], S())).toEqual([])
  })
})

describe('longestHomeStretch / longestAwayStint', () => {
  const trips = [
    TRIP({ departDate: '2019-01-10', returnDate: '2019-01-15' }), // away 5
    TRIP({ departDate: '2019-07-01', returnDate: '2019-08-12' }), // away 42 (the long stint)
    TRIP({ departDate: '2019-08-20', returnDate: '2019-08-24' }), // away 4
  ]

  it('longest away stint is the 42-day summer trip', () => {
    const s = longestAwayStint(trips)!
    expect(s.days).toBe(42)
    expect(s.startDate).toBe('2019-07-01')
    expect(s.endDate).toBe('2019-08-11') // last away day = day before return
  })

  it('merges back-to-back trips into one away stint', () => {
    // Two trips with no home night between them (return day == next depart day) → merge.
    const s = longestAwayStint([
      TRIP({ departDate: '2021-03-01', returnDate: '2021-03-06' }), // away 5
      TRIP({ departDate: '2021-03-06', returnDate: '2021-03-16' }), // away 10, starts the day home ended
    ])!
    expect(s.days).toBe(15)
    expect(s.startDate).toBe('2021-03-01')
  })

  it('longest home stretch is the gap between the Jan trip return and the Jul departure', () => {
    const s = longestHomeStretch(trips)!
    // Home from 2019-01-15 (got home) up to 2019-07-01 (departed) → Jan15..Jun30.
    const days = Math.round((Date.parse('2019-07-01') - Date.parse('2019-01-15')) / 86_400_000)
    expect(s.days).toBe(days)
    expect(s.startDate).toBe('2019-01-15')
    expect(s.endDate).toBe('2019-06-30')
  })

  it('return null with no trips', () => {
    expect(longestHomeStretch([])).toBeNull()
    expect(longestAwayStint([])).toBeNull()
  })
})
