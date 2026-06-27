import { describe, it, expect } from 'vitest'
import { lookupAirport, lookupAirline, classifyAircraft, airportToGroup, regionName, aircraftFamily } from '../../engine/reference'

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
  it('groups aircraft sub-variants into families but keeps different models apart', () => {
    expect(aircraftFamily('Boeing 737-800')).toBe('Boeing 737')
    expect(aircraftFamily('Boeing 737 MAX 8')).toBe('Boeing 737')
    expect(aircraftFamily('Boeing 777-300 ER')).toBe('Boeing 777')
    expect(aircraftFamily('Boeing 737-700')).not.toBe(aircraftFamily('Boeing 777-200 ER')) // 737 ≠ 777
    expect(aircraftFamily('Airbus A320neo')).toBe('Airbus A320')
    expect(aircraftFamily('Airbus A321')).toBe('Airbus A321') // different model number kept separate
    expect(aircraftFamily('Airbus A330-300')).toBe('Airbus A330')
    expect(aircraftFamily('Embraer 175')).toBe('Embraer 175') // other manufacturers unchanged
  })
})
