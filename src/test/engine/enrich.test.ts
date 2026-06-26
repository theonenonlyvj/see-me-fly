import { describe, it, expect } from 'vitest'
import { enrichFlight } from '../../engine/enrich'
import { DEFAULT_DURATION_CONSTANTS as C } from '../../engine/constants'
import { parseFlightyCsv, REQUIRED_COLUMNS } from '../../engine/parse'

const H = REQUIRED_COLUMNS.join(',')
const one = (line: string) => parseFlightyCsv([H, line].join('\n')).rows[0]
const TODAY = '2026-06-25'

describe('enrichFlight', () => {
  it('resolves names, distance, class, and delay', () => {
    const raw = one('2022-05-01,AAL,100,DFW,ORD,,,,,false,,2022-05-01T08:00:00,,2022-05-01T08:20:00,2022-05-01T08:25:00,2022-05-01T10:00:00,2022-05-01T09:55:00,2022-05-01T10:10:00,2022-05-01T10:20:00,Boeing 777,,,,,,,,id,,,,,')
    const f = enrichFlight(raw, TODAY, C)
    expect(f.airlineName).toMatch(/American/i)
    expect(f.distanceMi).toBeGreaterThan(798)
    expect(f.aircraftClass).toBe('wide')
    expect(f.delayMin).toBe(10) // gate arr actual 10:20 vs sched 10:10
    expect(f.flown).toBe(true)
  })

  it('treats RPJ->RPJ as a local flight: distance 0, ~20min, counts (not excluded)', () => {
    const raw = one('2013-08-18,,,RPJ,RPJ,,,,,false,,2013-08-18T12:00,,,,,,2013-08-18T12:30,,DHC-6 Twin Otter,N901ST,,,,,,,,,,,')
    const f = enrichFlight(raw, TODAY, C)
    expect(f.isLocalFlight).toBe(true)
    expect(f.distanceMi).toBe(0)
    expect(f.durationMin).toBe(20)
    expect(f.excluded).toBe(false)
    expect(f.airlineName).toBe('Unknown airline')
  })

  it('diverts: effective To = diverted-to, intended kept', () => {
    const raw = one('2019-07-10,AAL,1373,DFW,LBB,,,,,false,SPS,2019-07-10T18:00,,,,,,,,Boeing 737-800,,,,,,,,,,,')
    const f = enrichFlight(raw, TODAY, C)
    expect(f.toCode).toBe('SPS')
    expect(f.intendedToCode).toBe('LBB')
    expect(f.diverted).toBe(true)
  })

  it('flags an unresolved endpoint', () => {
    const raw = one('2020-01-01,AAL,1,ZZZ,DFW,,,,,false,,2020-01-01T09:00,,,,,,,,Boeing 737,,,,,,,,,,,')
    const f = enrichFlight(raw, TODAY, C)
    expect(f.resolved).toBe(false)
    expect(f.distanceMi).toBeNull()
  })

  it('marks a future-dated row as not flown', () => {
    const raw = one('2026-08-22,AAL,2,DFW,LAX,,,,,false,,,,,,,,,,Airbus A321,,,,,,,,,,,')
    const f = enrichFlight(raw, TODAY, C)
    expect(f.flown).toBe(false)
  })

  it('reads departure hour from raw local time (no tz shift)', () => {
    const raw = one('2015-06-01,AAL,3,DFW,LAX,,,,,false,,2015-06-01T08:30,2015-06-01T08:35,,,,,,,Airbus A321,,,,,,,,,,,')
    const f = enrichFlight(raw, TODAY, C)
    expect(f.depHourLocal).toBe(8)
  })

  it('applies an override (exclude / duration)', () => {
    // override file seeds RPJ with durationMinOverride:null, so duration stays data-derived (20);
    // here we just assert the override path does not crash and keeps the flight.
    const raw = one('2013-08-18,,,RPJ,RPJ,,,,,false,,2013-08-18T12:00,,,,,,2013-08-18T12:30,,DHC-6 Twin Otter,N901ST,,,,,,,,,,,')
    const f = enrichFlight(raw, TODAY, C)
    expect(f.excluded).toBe(false)
    expect(f.durationMin).toBe(20)
  })

  it('a durationMinOverride wins over the computed duration', () => {
    const raw = one('2018-01-01,AAL,1,DFW,ORD,,,,,false,,2018-01-01T09:00,,,,,,,,Boeing 737,,,,,,,,,,,')
    const f = enrichFlight(raw, TODAY, C, () => ({ signature: 'x', durationMinOverride: 99 }))
    expect(f.durationMin).toBe(99)
    expect(f.durationSource).toBe('override')
  })

  it('a distanceMiOverride wins over the computed distance', () => {
    const raw = one('2018-01-01,AAL,1,DFW,ORD,,,,,false,,2018-01-01T09:00,,,,,,,,Boeing 737,,,,,,,,,,,')
    const f = enrichFlight(raw, TODAY, C, () => ({ signature: 'x', distanceMiOverride: 123 }))
    expect(f.distanceMi).toBe(123)
  })

  it('an exclude override marks the flight excluded', () => {
    const raw = one('2018-01-01,AAL,1,DFW,ORD,,,,,false,,2018-01-01T09:00,,,,,,,,Boeing 737,,,,,,,,,,,')
    const f = enrichFlight(raw, TODAY, C, () => ({ signature: 'x', exclude: true }))
    expect(f.excluded).toBe(true)
  })
})
