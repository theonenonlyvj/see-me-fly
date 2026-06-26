import { describe, it, expect } from 'vitest'
import { haversineMi } from '../../engine/distance'

describe('haversineMi', () => {
  it('DFW->ORD is ~802 mi', () => {
    const d = haversineMi(32.8968, -97.0380, 41.9786, -87.9048)
    expect(d).toBeGreaterThan(798)
    expect(d).toBeLessThan(806)
  })
  it('identical points are 0', () => {
    expect(haversineMi(40, -100, 40, -100)).toBe(0)
  })
})
