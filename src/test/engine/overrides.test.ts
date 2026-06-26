import { describe, it, expect } from 'vitest'
import { signatureOf, overrideFor } from '../../engine/overrides'
import type { RawFlight } from '../../engine/types'

const raw = (over: Partial<RawFlight>): RawFlight => ({
  rawIndex: 0, date: '2013-08-18', airlineCode: '', flightNumber: '', fromCode: 'RPJ', toCode: 'RPJ',
  canceled: false, divertedToCode: '', gateDepSched: '2013-08-18T12:00', gateDepActual: '', takeoffSched: '',
  takeoffActual: '', landingSched: '', landingActual: '', gateArrSched: '2013-08-18T12:30', gateArrActual: '',
  aircraftType: 'DHC-6 Twin Otter', tail: 'N901ST', pnr: '', seat: '', cabin: '', reason: '', notes: '', flightyId: '',
  ...over,
})

describe('overrides', () => {
  it('builds the signature', () => {
    expect(signatureOf(raw({}))).toBe('2013-08-18|RPJ|RPJ|2013-08-18T12:00')
  })
  it('matches the seeded RPJ override', () => {
    expect(overrideFor(raw({}))).not.toBeNull()
  })
  it('returns null for a non-matching flight', () => {
    expect(overrideFor(raw({ date: '2020-01-01', gateDepSched: '2020-01-01T09:00' }))).toBeNull()
  })
})
