import { describe, it, expect } from 'vitest'
import { tzDirection, modalDepartureHour } from '../../app/lib/body-clock'
import type { EnrichedFlight } from '../../engine'

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

describe('tzDirection', () => {
  it("reads EAST when the wall clock advanced LESS than real time (DFW→LGA loses 1h)", () => {
    // Depart 08:00 local (CT), true elapsed 3h, arrive 12:00 local (ET).
    // Local wall clock advanced 4h but true elapsed is 3h → wait, that's west.
    // EAST = lose time: local advanced LESS than true. DFW(CT)→LGA(ET): leave 8:00CT,
    // 3h in the air, land 12:00ET. Local hours: 8→12 = 4. Hmm that GAINS an hour.
    // Correct DFW→LGA (going east loses 1h): leave 8:00CT, fly 3h true, land 12:00ET.
    // 8:00CT == 9:00ET; +3h true = 12:00ET. Local wall: dep 8, arr 12 → advanced 4.
    // trueElapsed 3h. 4-3 = +1 → that's a GAIN. So to LOSE time we need arr local < dep+true.
    // Model an eastbound loss directly: dep 08:00 local, true elapsed 3h, arr LOCAL 10:00
    // (only advanced 2h on the wall while 3h really passed → lost 1h → EAST).
    const f = mkFlight({
      depHourLocal: 8,
      arrHourLocal: 10,
      depUtcMs: T,
      arrUtcMs: T + 3 * HOUR,
    })
    expect(tzDirection(f)).toBe('east')
  })

  it('reads WEST when the wall clock advanced MORE than real time (LHR→DFW gains 6h)', () => {
    // Depart 10:00 local, true elapsed 3h, arrive 19:00 local → the wall clock advanced 9h
    // while only 3h really passed → gained 6h → WEST. (A big westward gain like LHR→DFW.)
    const f = mkFlight({
      depHourLocal: 10,
      arrHourLocal: 19,
      depUtcMs: T,
      arrUtcMs: T + 3 * HOUR,
    })
    expect(tzDirection(f)).toBe('west')
  })

  it('reads SAME when local elapsed equals true elapsed', () => {
    const f = mkFlight({
      depHourLocal: 9,
      arrHourLocal: 12,
      depUtcMs: T,
      arrUtcMs: T + 3 * HOUR,
    })
    expect(tzDirection(f)).toBe('same')
  })

  it('handles a wall-clock crossing midnight (dep 23 → arr 02, +3h true) as SAME', () => {
    const f = mkFlight({
      depHourLocal: 23,
      arrHourLocal: 2,
      depUtcMs: T,
      arrUtcMs: T + 3 * HOUR,
    })
    // local elapsed = ((2-23)%24+24)%24 = 3h, true 3h → same
    expect(tzDirection(f)).toBe('same')
  })

  it("falls back to durationMin for true elapsed when UTC instants are missing but local hours exist", () => {
    // dep 8, arr 12 → local advanced 4h; duration 180min (3h) → gained 1h → WEST
    const f = mkFlight({
      depHourLocal: 8,
      arrHourLocal: 12,
      depUtcMs: null,
      arrUtcMs: null,
      durationMin: 180,
    })
    expect(tzDirection(f)).toBe('west')
  })

  it("returns 'same' when there is no way to compute true elapsed (no UTC, no duration)", () => {
    const f = mkFlight({
      depHourLocal: 8,
      arrHourLocal: 12,
      depUtcMs: null,
      arrUtcMs: null,
      durationMin: null,
    })
    expect(tzDirection(f)).toBe('same')
  })

  it("returns 'same' when local hours are missing (unplaceable but must not crash)", () => {
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
