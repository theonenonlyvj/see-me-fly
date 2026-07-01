import { describe, it, expect } from 'vitest'
import { haversineMi, bearingDeg } from '../../engine/distance'

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

describe('bearingDeg', () => {
  it('due north is 0°', () => {
    // Same longitude, target farther north.
    expect(bearingDeg(0, 0, 10, 0)).toBeCloseTo(0, 5)
  })
  it('due south is 180°', () => {
    expect(bearingDeg(0, 0, -10, 0)).toBeCloseTo(180, 5)
  })
  it('due east along the equator is 90°', () => {
    // On the equator a small eastward step has an initial bearing of exactly 90°.
    expect(bearingDeg(0, 0, 0, 10)).toBeCloseTo(90, 5)
  })
  it('due west along the equator is 270°', () => {
    expect(bearingDeg(0, 0, 0, -10)).toBeCloseTo(270, 5)
  })
  it('a NE diagonal from the equator is 45°', () => {
    // From (0,0) to (0.01, 0.01): near the equator cos(lat)≈1 so the initial bearing ≈ 45°.
    expect(bearingDeg(0, 0, 0.01, 0.01)).toBeCloseTo(45, 2)
  })
  it('always normalizes to [0, 360)', () => {
    const b = bearingDeg(51.47, -0.45, 32.9, -97.04) // LHR → DFW (roughly WNW)
    expect(b).toBeGreaterThanOrEqual(0)
    expect(b).toBeLessThan(360)
  })
  it('coincident points return 0', () => {
    expect(bearingDeg(40, -100, 40, -100)).toBe(0)
  })
})
