import { describe, it, expect } from 'vitest'
import { computeDuration, localToUtcMs } from '../../engine/duration'
import { lookupAirport } from '../../engine/reference'
import { DEFAULT_DURATION_CONSTANTS as C } from '../../engine/constants'
import type { RawFlight } from '../../engine/types'

const blankRaw = (over: Partial<RawFlight>): RawFlight => ({
  rawIndex: 0, date: '', airlineCode: '', flightNumber: '', fromCode: '', toCode: '',
  canceled: false, divertedToCode: '', gateDepSched: '', gateDepActual: '', takeoffSched: '',
  takeoffActual: '', landingSched: '', landingActual: '', gateArrSched: '', gateArrActual: '',
  aircraftType: '', tail: '', pnr: '', seat: '', cabin: '', reason: '', notes: '', flightyId: '',
  ...over,
})

describe('timezone-aware duration', () => {
  it('localToUtcMs respects the IANA zone', () => {
    const utc = localToUtcMs('2015-01-10T17:00', 'Asia/Tokyo')! // = 2015-01-10T08:00Z
    expect(new Date(utc).toISOString()).toBe('2015-01-10T08:00:00.000Z')
  })

  it('HND->DFW: naive subtraction is negative; tz-aware is +780min', () => {
    const from = lookupAirport('HND')!
    const to = lookupAirport('DFW')!
    const raw = blankRaw({ takeoffActual: '2015-01-10T17:00', landingActual: '2015-01-10T15:00' })
    const { min, source } = computeDuration({ from, to, raw, distanceMi: 6000, constants: C })
    expect(source).toBe('actual')
    expect(min).toBe(780)
  })

  it('falls back to the distance estimate when actuals are missing', () => {
    const from = lookupAirport('AUS')!
    const to = lookupAirport('DEN')!
    const raw = blankRaw({}) // no timestamps at all
    const { min, source } = computeDuration({ from, to, raw, distanceMi: 700, constants: C })
    expect(source).toBe('estimate')
    expect(min).toBe(Math.round(C.taxiMin + (700 / C.cruiseMph) * 60 + C.climbDescentMin)) // 30 + 84 + 15 = 129
  })

  it('zero-distance local flight uses gate-to-gate minus taxi (~20min for RPJ)', () => {
    const rpj = lookupAirport('RPJ')!
    const raw = blankRaw({ gateDepSched: '2013-08-18T12:00', gateArrSched: '2013-08-18T12:30' })
    const { min, source } = computeDuration({ from: rpj, to: rpj, raw, distanceMi: 0, constants: C })
    expect(source).toBe('gate')
    expect(min).toBe(20) // 30min gate - 10min gateTaxi
  })

  it('zero-distance local flight with NO timestamps falls back to the local default', () => {
    const rpj = lookupAirport('RPJ')!
    const raw = blankRaw({}) // no takeoff/landing/gate times at all
    const { min, source } = computeDuration({ from: rpj, to: rpj, raw, distanceMi: 0, constants: C })
    expect(source).toBe('localDefault')
    expect(min).toBe(C.localFlightDefaultMin) // 20
  })

  it('a degenerate "actual" (takeoff == landing) is rejected and falls through to the estimate', () => {
    const from = lookupAirport('DAL')!
    const to = lookupAirport('OKC')!
    // both actual timestamps identical -> 0 air time -> must NOT be reported as a 0-min "actual"
    const raw = blankRaw({ takeoffActual: '2014-01-07T13:00', landingActual: '2014-01-07T13:00' })
    const { min, source } = computeDuration({ from, to, raw, distanceMi: 175, constants: C })
    expect(source).toBe('estimate')
    expect(min).toBeGreaterThan(0)
  })

  it('never returns a negative duration', () => {
    const from = lookupAirport('HND')!
    const to = lookupAirport('DFW')!
    const raw = blankRaw({ takeoffActual: '2015-01-10T17:00', landingActual: '2015-01-10T10:00' })
    const { min } = computeDuration({ from, to, raw, distanceMi: 6000, constants: C })
    expect(min).toBeGreaterThanOrEqual(0)
  })
})
