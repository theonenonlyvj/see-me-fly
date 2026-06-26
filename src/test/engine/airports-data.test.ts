import { describe, it, expect } from 'vitest'
import airports from '../../reference/airports.json'

type Rec = { iata: string | null; localCode: string | null; ident: string; name: string; municipality: string; lat: number; lon: number; country: string; region: string; continent: string; tz: string }

const byIata = (code: string) => (airports as Rec[]).find((a) => a.iata === code)
const byLocal = (code: string) => (airports as Rec[]).find((a) => a.localCode === code)

describe('airports.json', () => {
  it('resolves DFW with coords, region, continent, tz', () => {
    const dfw = byIata('DFW')!
    expect(dfw).toBeTruthy()
    expect(dfw.lat).toBeCloseTo(32.897, 1)
    expect(dfw.lon).toBeCloseTo(-97.038, 1)
    expect(dfw.region).toBe('US-TX')
    expect(dfw.continent).toBe('NA')
    expect(dfw.tz).toBe('America/Chicago')
    expect(dfw.name).toMatch(/Dallas/i)
  })
  it('includes HNL on continent OC (Hawaii)', () => {
    expect(byIata('HNL')!.continent).toBe('OC')
  })
  it('includes RPJ via FAA local_code (Rochelle, IL — blank IATA)', () => {
    const rpj = byLocal('RPJ')!
    expect(rpj).toBeTruthy()
    expect(rpj.iata).toBeNull()
    expect(rpj.region).toBe('US-IL')
    expect(rpj.continent).toBe('NA')
  })
  it('includes MEX with a Mexico City region code', () => {
    expect(byIata('MEX')!.region).toMatch(/^MX-/)
  })
})
