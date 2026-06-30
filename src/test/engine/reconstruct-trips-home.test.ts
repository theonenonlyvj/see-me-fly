import { describe, it, expect } from 'vitest'
import { reconstructTrips, tripsForYear } from '../../engine/stats'
import { buildMovements } from '../../engine/ground-links'
import type { EnrichedFlight, GroundLink, Settings, HomeEra } from '../../engine/types'

// ── Lightweight EnrichedFlight fixtures ──────────────────────────────────────
// reconstructTrips only reads resolved/isLocalFlight/fromCode/toCode/date/year/
// depUtcMs/arrUtcMs/rawIndex/distanceMi. Build just those.
const HR = 3_600_000
const ms = (date: string, hh = 0) => Date.parse(`${date}T00:00:00Z`) + hh * HR

let seq = 0
const FL = (o: Partial<EnrichedFlight>): EnrichedFlight => {
  const date = o.date ?? '2020-01-01'
  return {
    resolved: true,
    isLocalFlight: false,
    rawIndex: seq++,
    date,
    year: o.year ?? Number(date.slice(0, 4)),
    fromCode: 'AAA',
    toCode: 'BBB',
    depUtcMs: ms(date, 9),
    arrUtcMs: ms(date, 11),
    distanceMi: 100,
    ...o,
  } as EnrichedFlight
}

const LK = (o: Partial<GroundLink> & Pick<GroundLink, 'date' | 'fromAirport' | 'toAirport'>): GroundLink => ({
  mode: 'drive',
  ...o,
})

const S = (over: Partial<Settings> = {}): Settings => ({
  groupAirports: false, explicitlyUnique: false, includeCanceled: false, excludeBeforeDate: null,
  home: 'DFW', homeHistory: [], groundLinks: [], excludeHomeFromRankings: false, layoverMaxHours: 5,
  excludeDayTrips: true, splitCountriesByState: [], distanceEdges: [300, 700, 1500, 3000, 6000],
  mergeDefunctAirlines: false,
  duration: { cruiseMph: 500, taxiMin: 0, climbDescentMin: 0, gateTaxiMin: 0, localFlightDefaultMin: 30, localFlightMinMin: 10 },
  ...over,
})

// RDU-college → DEN-move → DFW-back, ascending eras
const ERAS: HomeEra[] = [
  { start: '2008-08-18', airports: ['RDU'] },
  { start: '2019-06-01', airports: ['DEN', 'SEA', 'PAE'] },
  { start: '2021-02-04', airports: ['DFW', 'DAL'] },
]

describe('buildMovements', () => {
  it('merges flights + links into one chronologically sorted stream', () => {
    seq = 0
    const f1 = FL({ date: '2020-01-01', fromCode: 'DFW', toCode: 'LAX' })
    const f2 = FL({ date: '2020-01-05', fromCode: 'LAX', toCode: 'SFO' })
    const link = LK({ date: '2020-01-03', fromAirport: 'LAX', toAirport: 'SAN' })
    const mv = buildMovements([f2, f1], [link])
    expect(mv.map((m) => m.kind)).toEqual(['flight', 'link', 'flight'])
    expect(mv[0].fromCode).toBe('DFW')
    expect(mv[1].kind).toBe('link')
    expect(mv[1].toCode).toBe('SAN')
    expect(mv[2].toCode).toBe('SFO')
  })

  it('tiebreaks equal sortMs: flights before links', () => {
    seq = 0
    const f = FL({ date: '2020-01-01', fromCode: 'DFW', toCode: 'LAX', depUtcMs: ms('2020-01-01', 0) })
    const link = LK({ date: '2020-01-01', fromAirport: 'LAX', toAirport: 'SAN' }) // start-of-day sortMs == f's
    const mv = buildMovements([f], [link])
    expect(mv[0].kind).toBe('flight')
    expect(mv[1].kind).toBe('link')
  })
})

describe('reconstructTrips — all-time home-by-date', () => {
  it('relocation: RDU→…→COS then drive COS→DEN closes as ONE spanning trip; SEA connection does not split', () => {
    seq = 0
    const home = S({ home: null, homeHistory: ERAS })
    // Leave RDU-era home; long Europe trip, then SEA same-day connection to COS, then drive to DEN (now home).
    const flights = [
      FL({ date: '2019-05-26', fromCode: 'MCO', toCode: 'IAD' }),
      FL({ date: '2019-05-26', fromCode: 'IAD', toCode: 'FRA', depUtcMs: ms('2019-05-26', 14), arrUtcMs: ms('2019-05-27', 4) }),
      FL({ date: '2019-06-22', fromCode: 'MUC', toCode: 'IAD', depUtcMs: ms('2019-06-22', 6), arrUtcMs: ms('2019-06-22', 12) }),
      // SEA is a co-home hub for the DEN era — but on 2019-06-22 home is still RDU; regardless this is a connection.
      FL({ date: '2019-06-22', fromCode: 'IAD', toCode: 'SEA', depUtcMs: ms('2019-06-22', 13), arrUtcMs: ms('2019-06-22', 15) }),
      FL({ date: '2019-06-22', fromCode: 'SEA', toCode: 'COS', depUtcMs: ms('2019-06-22', 16), arrUtcMs: ms('2019-06-22', 18) }),
    ]
    const links = [LK({ date: '2019-07-03', arriveDate: '2019-07-05', fromAirport: 'COS', toAirport: 'DEN' })]
    const trips = reconstructTrips(flights, { ...home, groundLinks: links })
    expect(trips).toHaveLength(1)
    const t = trips[0]
    expect(t.departDate).toBe('2019-05-26')
    expect(t.flights).toHaveLength(5) // all five flight legs; the link is a bridge, not a flight
    expect(t.estimated).toBeUndefined()
    expect(t.roundTrip).toBe(true) // closed by a ground link arriving home
    // nights span from first leg to the link's home arrival (~Jul 5)
    expect(t.nights).toBeGreaterThan(35)
  })

  it('connection-not-close: SEA→DEN same-day within layoverMaxHours does not close at SEA', () => {
    seq = 0
    const home = S({ home: null, homeHistory: ERAS })
    // During DEN era; SEA is a co-home airport. A same-day SEA connection must NOT close the trip.
    const flights = [
      FL({ date: '2019-08-01', fromCode: 'DEN', toCode: 'AUS', depUtcMs: ms('2019-08-01', 8), arrUtcMs: ms('2019-08-01', 10) }),
      FL({ date: '2019-08-05', fromCode: 'AUS', toCode: 'SEA', depUtcMs: ms('2019-08-05', 8), arrUtcMs: ms('2019-08-05', 10) }),
      FL({ date: '2019-08-05', fromCode: 'SEA', toCode: 'DEN', depUtcMs: ms('2019-08-05', 12), arrUtcMs: ms('2019-08-05', 13) }),
    ]
    const trips = reconstructTrips(flights, home)
    expect(trips).toHaveLength(1)
    expect(trips[0].flights).toHaveLength(3)
    expect(trips[0].roundTrip).toBe(true) // ends back at DEN
    expect(trips[0].nights).toBe(4)
  })

  it('closes at SEA when the redeparture is NOT a connection (gap too long)', () => {
    seq = 0
    const home = S({ home: null, homeHistory: ERAS })
    // SEA is home in the DEN era; landing there and NOT redeparting within layoverMaxHours closes.
    const flights = [
      FL({ date: '2019-08-01', fromCode: 'DEN', toCode: 'AUS', depUtcMs: ms('2019-08-01', 8), arrUtcMs: ms('2019-08-01', 10) }),
      FL({ date: '2019-08-05', fromCode: 'AUS', toCode: 'SEA', depUtcMs: ms('2019-08-05', 8), arrUtcMs: ms('2019-08-05', 10) }),
      // re-departs SEA 2 days later → a real arrival home, then a fresh trip
      FL({ date: '2019-08-07', fromCode: 'SEA', toCode: 'DEN', depUtcMs: ms('2019-08-07', 12), arrUtcMs: ms('2019-08-07', 13) }),
    ]
    const trips = reconstructTrips(flights, home)
    expect(trips).toHaveLength(2)
    expect(trips[0].roundTrip).toBe(true)
    expect(trips[0].flights.map((f) => f.toCode)).toEqual(['AUS', 'SEA'])
  })

  it('link to non-home BRIDGES: extends the open trip without closing', () => {
    seq = 0
    const home = S({ home: 'DFW' })
    const flights = [
      FL({ date: '2020-03-01', fromCode: 'DFW', toCode: 'BOS' }),
      // after a bus from Boston to NYC (non-home), then fly NYC home
      FL({ date: '2020-03-05', fromCode: 'EWR', toCode: 'DFW', depUtcMs: ms('2020-03-05', 9), arrUtcMs: ms('2020-03-05', 12) }),
    ]
    const links = [LK({ date: '2020-03-03', fromAirport: 'BOS', toAirport: 'EWR', mode: 'bus' })]
    const trips = reconstructTrips(flights, { ...home, groundLinks: links })
    expect(trips).toHaveLength(1)
    expect(trips[0].flights).toHaveLength(2) // both flights; bus is a bridge
    expect(trips[0].roundTrip).toBe(true)
    expect(trips[0].nights).toBe(4)
  })

  it('inferred end: leave home, no return, no link, then a fresh depart-from-home closes prior at its last leg', () => {
    seq = 0
    const home = S({ home: 'DFW' })
    const flights = [
      FL({ date: '2020-04-01', fromCode: 'DFW', toCode: 'LHR' }), // open trip, never returns
      FL({ date: '2020-06-01', fromCode: 'DFW', toCode: 'AUS' }), // fresh depart from home → closes prior
      FL({ date: '2020-06-02', fromCode: 'AUS', toCode: 'DFW' }),
    ]
    const trips = reconstructTrips(flights, home)
    expect(trips).toHaveLength(2)
    expect(trips[0].estimated).toEqual({ boundary: 'end' })
    expect(trips[0].returnDate).toBe('2020-04-01') // collapsed to last recorded leg
    expect(trips[0].nights).toBe(0)
    expect(trips[1].estimated).toBeUndefined()
    expect(trips[1].roundTrip).toBe(true)
  })

  it('inferred start: a lone homeward leg SFO→DFW with no prior departure → 0-night trip, estimated start', () => {
    seq = 0
    const home = S({ home: 'DFW' })
    const trips = reconstructTrips([FL({ date: '2020-05-10', fromCode: 'SFO', toCode: 'DFW' })], home)
    expect(trips).toHaveLength(1)
    expect(trips[0].estimated).toEqual({ boundary: 'start' })
    expect(trips[0].nights).toBe(0)
    expect(trips[0].departDate).toBe('2020-05-10')
    expect(trips[0].returnDate).toBe('2020-05-10')
    expect(trips[0].roundTrip).toBe(true)
  })

  it('Dec→Jan trip reconstructs as ONE trip; tripsForYear returns it under departure year only', () => {
    seq = 0
    const home = S({ home: 'DFW' })
    const flights = [
      FL({ date: '2019-12-28', fromCode: 'DFW', toCode: 'NRT', depUtcMs: ms('2019-12-28', 9), arrUtcMs: ms('2019-12-29', 4) }),
      FL({ date: '2020-01-04', fromCode: 'NRT', toCode: 'DFW', depUtcMs: ms('2020-01-04', 9), arrUtcMs: ms('2020-01-04', 18) }),
    ]
    const trips = reconstructTrips(flights, home)
    expect(trips).toHaveLength(1)
    expect(trips[0].year).toBe(2019) // departure year
    expect(trips[0].nights).toBe(7)
    expect(tripsForYear(trips, 2019)).toHaveLength(1)
    expect(tripsForYear(trips, 2020)).toHaveLength(0)
    expect(tripsForYear(trips, null)).toHaveLength(1) // all-time
  })

  it('hasHome gate: no home at all → no trips', () => {
    seq = 0
    expect(reconstructTrips([FL({ fromCode: 'DFW', toCode: 'AUS' })], S({ home: null }))).toEqual([])
  })

  it('backward-compat: single-home round trip + open trip, unchanged shape', () => {
    seq = 0
    const home = S({ home: 'DFW' })
    const flights = [
      FL({ date: '2018-01-02', fromCode: 'DFW', toCode: 'ORD', depUtcMs: ms('2018-01-02', 9), arrUtcMs: ms('2018-01-02', 11) }),
      FL({ date: '2018-01-04', fromCode: 'ORD', toCode: 'DFW', depUtcMs: ms('2018-01-04', 9), arrUtcMs: ms('2018-01-04', 11) }),
      FL({ date: '2018-03-01', fromCode: 'DFW', toCode: 'LHR', depUtcMs: ms('2018-03-01', 9), arrUtcMs: ms('2018-03-01', 20) }),
    ]
    const trips = reconstructTrips(flights, home)
    expect(trips).toHaveLength(2)
    expect(trips[0]).toMatchObject({ nights: 2, roundTrip: true })
    expect(trips[1].roundTrip).toBe(false)
    expect(trips[1].estimated).toEqual({ boundary: 'end' })
  })
})
