import { describe, it, expect } from 'vitest'
import groups from '../../reference/airport-groups.json'
import classes from '../../reference/aircraft-classes.json'
import overrides from '../../reference/flight-overrides.json'

describe('curated reference files', () => {
  it('groups Dallas as DFW+DAL', () => {
    const dallas = (groups as { name: string; airports: string[] }[]).find((g) => g.name === 'Dallas')!
    expect(dallas.airports).toEqual(expect.arrayContaining(['DFW', 'DAL']))
  })
  it('has no airport code assigned to two different metros', () => {
    const seen = new Map<string, string>()
    for (const g of groups as { name: string; airports: string[] }[]) {
      for (const code of g.airports) {
        const prev = seen.get(code)
        expect(prev, `${code} is in both "${prev}" and "${g.name}"`).toBeUndefined()
        seen.set(code, g.name)
      }
    }
  })
  it('includes the worldwide metros (e.g. Dubai, Tokyo, Sao Paulo)', () => {
    const names = (groups as { name: string }[]).map((g) => g.name)
    expect(names).toEqual(expect.arrayContaining(['Dubai', 'Tokyo', 'Sao Paulo', 'Frankfurt', 'Melbourne']))
  })
  it('classifies the Twin Otter / Helio as prop', () => {
    const list = classes as { pattern: string; class: string }[]
    const match = (name: string) => list.find((r) => name.toLowerCase().includes(r.pattern.toLowerCase()))?.class
    expect(match('DHC-6 Twin Otter')).toBe('prop')
    expect(match('Helio H-500 Twin Courier')).toBe('prop')
    expect(match('Boeing 777')).toBe('wide')
    expect(match('Boeing 737-800')).toBe('narrow')
    expect(match('Bombardier CRJ700')).toBe('regional')
  })
  it('seeds the RPJ skydiving override', () => {
    const o = (overrides as { overrides: { signature: string }[] }).overrides
    expect(o.some((x) => x.signature === '2013-08-18|RPJ|RPJ|2013-08-18T12:00')).toBe(true)
  })
})
