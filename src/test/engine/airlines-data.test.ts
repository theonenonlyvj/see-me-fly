import { describe, it, expect } from 'vitest'
import airlines from '../../reference/airlines.json'
import overrides from '../../reference/airline-overrides.json'

const map = { ...(airlines as Record<string, string>), ...(overrides as Record<string, string>) }

describe('airlines.json (+ overrides)', () => {
  it('AAL resolves to American Airlines', () => {
    expect(map['AAL']).toMatch(/American/i)
  })
  it('JAL resolves to a single canonical Japan Airlines (collision dedup)', () => {
    expect(map['JAL']).toMatch(/Japan Airlines/i)
  })
  it('override fills OpenFlights misses', () => {
    expect(map['NOZ']).toBe('Norse Atlantic Airways')
    expect(map['BEL']).toBe('Brussels Airlines')
  })
})
