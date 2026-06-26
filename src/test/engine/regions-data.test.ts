import { describe, it, expect } from 'vitest'
import regions from '../../reference/regions.json'

const { regions: r, countries: c } = regions as { regions: Record<string, string>; countries: Record<string, string> }

describe('regions.json', () => {
  it('names US states', () => {
    expect(r['US-TX']).toMatch(/Texas/i)
  })
  it('aliases deprecated MX-DIF to the Mexico City name', () => {
    expect(r['MX-DIF']).toBeTruthy()
    expect(r['MX-DIF']).toBe(r['MX-CMX'])
  })
  it('names India states', () => {
    expect(r['IN-TN']).toMatch(/Tamil Nadu/i)
  })
  it('names countries', () => {
    expect(c['US']).toMatch(/United States/i)
    expect(c['MX']).toMatch(/Mexico/i)
  })
})
