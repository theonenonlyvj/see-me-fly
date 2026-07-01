import { describe, it, expect } from 'vitest'
import { tzDirection, modalDepartureHour } from '../../app/lib/body-clock'
import type { EnrichedFlight, Airport } from '../../engine'

/** Minimal airport carrying only the tz (the field the exact path reads). */
function mkAirport(tz: string): Airport {
  return {
    iata: 'XXX', localCode: null, ident: 'XXX', name: '', municipality: '',
    lat: 0, lon: 0, country: 'US', region: 'US-TX', continent: 'NA', tz,
  }
}

/**
 * Minimal EnrichedFlight factory — only the fields tzDirection / modalDepartureHour read.
 * Times are given in absolute UTC ms and local wall-clock hours so we control the two clocks
 * independently (that gap is the whole signal).
 */
function mkFlight(o: Partial<EnrichedFlight>): EnrichedFlight {
  return {
    id: 'x',
    rawIndex: 0,
    date: '2020-01-01',
    year: 2020,
    airlineCode: 'AAL',
    airlineName: 'American',
    flightNumber: '1',
    fromCode: 'DFW',
    toCode: 'LGA',
    intendedToCode: null,
    from: null,
    to: null,
    resolved: true,
    distanceMi: 1000,
    durationMin: null,
    durationSource: null,
    delayMin: null,
    depHourLocal: null,
    arrHourLocal: null,
    depUtcMs: null,
    arrUtcMs: null,
    canceled: false,
    diverted: false,
    flown: true,
    isLocalFlight: false,
    excluded: false,
    aircraftType: '',
    aircraftClass: 'narrow',
    tail: '',
    seat: '',
    cabin: '',
    pnr: '',
    notes: '',
    ...o,
  }
}

const HOUR = 3_600_000
const T = Date.parse('2020-01-01T12:00:00Z') // arbitrary base instant

describe('tzDirection — exact tz-offset path (both airports carry a tz)', () => {
  // Physics: fly EAST → cross into later zones → LOSE time; fly WEST → GAIN time.
  it("reads EAST for a west→east flight (DFW/Central → LGA/Eastern, +1h ahead)", () => {
    const f = mkFlight({
      from: mkAirport('America/Chicago'),
      to: mkAirport('America/New_York'),
      depUtcMs: T,
      arrUtcMs: T + 3 * HOUR,
    })
    expect(tzDirection(f)).toBe('east')
  })

  it("reads WEST for an east→west flight (LHR/London → DFW/Central, gains 6h)", () => {
    const f = mkFlight({
      from: mkAirport('Europe/London'),
      to: mkAirport('America/Chicago'),
      depUtcMs: T,
      arrUtcMs: T + 9 * HOUR,
    })
    expect(tzDirection(f)).toBe('west')
  })

  it("reads WEST for transcon east→west (JFK/Eastern → LAX/Pacific, gains 3h)", () => {
    const f = mkFlight({
      from: mkAirport('America/New_York'),
      to: mkAirport('America/Los_Angeles'),
      depUtcMs: T,
      arrUtcMs: T + 6 * HOUR,
    })
    expect(tzDirection(f)).toBe('west')
  })

  it("reads SAME for a same-zone hop (DFW → AUS, both Central)", () => {
    const f = mkFlight({
      from: mkAirport('America/Chicago'),
      to: mkAirport('America/Chicago'),
      depUtcMs: T,
      arrUtcMs: T + 1 * HOUR,
    })
    expect(tzDirection(f)).toBe('same')
  })
})

describe('tzDirection — fallback path (no airport tz / no UTC instants)', () => {
  // (wallAdvanced − trueElapsed): ≥ +90m → east, ≤ −90m → west, else same.
  it("reads EAST when the wall clock advanced well past real elapsed (lost time)", () => {
    // dep 8, arr 13 local → wall advanced 5h; duration 180m (3h) → +120m → east
    const f = mkFlight({ depHourLocal: 8, arrHourLocal: 13, durationMin: 180 })
    expect(tzDirection(f)).toBe('east')
  })

  it("reads WEST when the wall clock lagged real elapsed (gained time)", () => {
    // dep 10, arr 12 local → wall advanced 2h; duration 480m (8h) → −360m → west
    const f = mkFlight({ depHourLocal: 10, arrHourLocal: 12, durationMin: 480 })
    expect(tzDirection(f)).toBe('west')
  })

  it("reads SAME within the ±90m dead-band (whole-hour truncation, no fabricated shift)", () => {
    // dep 8, arr 12 local → wall advanced 4h; duration 180m (3h) → +60m < 90 → same
    const f = mkFlight({ depHourLocal: 8, arrHourLocal: 12, durationMin: 180 })
    expect(tzDirection(f)).toBe('same')
  })

  it('handles a wall-clock crossing midnight (dep 23 → arr 02, +3h true) as SAME', () => {
    const f = mkFlight({ depHourLocal: 23, arrHourLocal: 2, depUtcMs: T, arrUtcMs: T + 3 * HOUR })
    expect(tzDirection(f)).toBe('same')
  })

  it("falls back to durationMin for true elapsed when UTC instants are missing", () => {
    const f = mkFlight({ depHourLocal: 8, arrHourLocal: 14, depUtcMs: null, arrUtcMs: null, durationMin: 180 })
    expect(tzDirection(f)).toBe('east') // +360 − 180 = +180 ≥ 90 → east
  })

  it("returns 'same' when there is no way to compute true elapsed (no UTC, no duration)", () => {
    const f = mkFlight({ depHourLocal: 8, arrHourLocal: 12, depUtcMs: null, arrUtcMs: null, durationMin: null })
    expect(tzDirection(f)).toBe('same')
  })

  it("returns 'same' when local hours are missing and no airport tz (unplaceable, must not crash)", () => {
    const f = mkFlight({ depHourLocal: null, arrHourLocal: null, depUtcMs: T, arrUtcMs: T + 3 * HOUR })
    expect(tzDirection(f)).toBe('same')
  })
})

describe('modalDepartureHour', () => {
  it('returns the most common departure hour and its count', () => {
    const flights = [
      mkFlight({ depHourLocal: 6 }),
      mkFlight({ depHourLocal: 6 }),
      mkFlight({ depHourLocal: 6 }),
      mkFlight({ depHourLocal: 9 }),
      mkFlight({ depHourLocal: null }), // ignored
    ]
    expect(modalDepartureHour(flights)).toEqual({ hour: 6, count: 3 })
  })

  it('returns null when no flight has a departure hour', () => {
    expect(modalDepartureHour([mkFlight({ depHourLocal: null })])).toBeNull()
    expect(modalDepartureHour([])).toBeNull()
  })

  it('breaks ties toward the earlier hour (deterministic)', () => {
    const flights = [
      mkFlight({ depHourLocal: 14 }),
      mkFlight({ depHourLocal: 14 }),
      mkFlight({ depHourLocal: 6 }),
      mkFlight({ depHourLocal: 6 }),
    ]
    expect(modalDepartureHour(flights)).toEqual({ hour: 6, count: 2 })
  })
})
