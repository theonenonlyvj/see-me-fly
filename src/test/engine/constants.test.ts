import { describe, it, expect } from 'vitest'
import { DEFAULT_DURATION_CONSTANTS, EARTH_RADIUS_MI } from '../../engine/constants'

describe('constants', () => {
  it('uses 500mph cruise + 30min taxi + 15 climb/descent', () => {
    expect(DEFAULT_DURATION_CONSTANTS.cruiseMph).toBe(500)
    expect(DEFAULT_DURATION_CONSTANTS.taxiMin).toBe(30)
    expect(DEFAULT_DURATION_CONSTANTS.climbDescentMin).toBe(15)
  })
  it('local flight default ~20min', () => {
    expect(DEFAULT_DURATION_CONSTANTS.localFlightDefaultMin).toBe(20)
  })
  it('Earth radius in miles', () => {
    expect(EARTH_RADIUS_MI).toBeCloseTo(3958.76, 1)
  })
})
