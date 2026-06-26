import { describe, it, expect } from 'vitest'
import { lookupAirport, lookupAirline, classifyAircraft, airportToGroup, regionName } from '../../engine/reference'

describe('reference lookups', () => {
  it('finds DFW by IATA', () => {
    expect(lookupAirport('DFW')?.region).toBe('US-TX')
  })
  it('finds RPJ by FAA local_code', () => {
    expect(lookupAirport('RPJ')?.region).toBe('US-IL')
  })
  it('returns null for an unknown code', () => {
    expect(lookupAirport('ZZZ')).toBeNull()
  })
  it('resolves airline names with override fallthrough', () => {
    expect(lookupAirline('AAL')).toMatch(/American/i)
    expect(lookupAirline('NOZ')).toBe('Norse Atlantic Airways')
    expect(lookupAirline('QZX')).toBeNull()
  })
  it('maps DFW and DAL to the Dallas group', () => {
    expect(airportToGroup.get('DFW')).toBe('Dallas')
    expect(airportToGroup.get('DAL')).toBe('Dallas')
  })
  it('classifies aircraft and names regions', () => {
    expect(classifyAircraft('Boeing 777')).toBe('wide')
    expect(classifyAircraft('')).toBe('unclassified')
    expect(regionName('US-TX')).toMatch(/Texas/i)
  })
})
