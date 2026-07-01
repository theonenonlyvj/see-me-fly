import { describe, it, expect } from 'vitest'
import { polar, dayOfYear, monthOfYear } from '../../app/lib/polar'

const EPS = 1e-9

describe('polar', () => {
  it('0° points straight up (12 o\'clock)', () => {
    const p = polar(0, 0, 10, 0)
    expect(p.x).toBeCloseTo(0, 9)
    expect(p.y).toBeCloseTo(-10, 9)
  })

  it('90° points right (3 o\'clock, clockwise)', () => {
    const p = polar(0, 0, 10, 90)
    expect(p.x).toBeCloseTo(10, 9)
    expect(p.y).toBeCloseTo(0, 9)
  })

  it('180° points straight down (6 o\'clock)', () => {
    const p = polar(0, 0, 10, 180)
    expect(p.x).toBeCloseTo(0, 9)
    expect(p.y).toBeCloseTo(10, 9)
  })

  it('270° points left (9 o\'clock)', () => {
    const p = polar(0, 0, 10, 270)
    expect(p.x).toBeCloseTo(-10, 9)
    expect(p.y).toBeCloseTo(0, 9)
  })

  it('respects the center offset', () => {
    const p = polar(5, 7, 10, 0)
    expect(Math.abs(p.x - 5)).toBeLessThan(EPS)
    expect(p.y).toBeCloseTo(-3, 9)
  })

  it('radius 0 returns the center', () => {
    const p = polar(3, 4, 0, 123)
    expect(p.x).toBeCloseTo(3, 9)
    expect(p.y).toBeCloseTo(4, 9)
  })
})

describe('dayOfYear', () => {
  it('Jan 1 is day 1', () => {
    expect(dayOfYear('2020-01-01')).toBe(1)
  })

  it('Feb 1 is day 32', () => {
    expect(dayOfYear('2021-02-01')).toBe(32)
  })

  it('Dec 31 of a leap year is 366', () => {
    expect(dayOfYear('2020-12-31')).toBe(366)
  })

  it('Dec 31 of a non-leap year is 365', () => {
    expect(dayOfYear('2021-12-31')).toBe(365)
  })

  it('handles a century non-leap year (1900)', () => {
    expect(dayOfYear('1900-12-31')).toBe(365)
  })

  it('handles a 400-divisible leap year (2000)', () => {
    expect(dayOfYear('2000-12-31')).toBe(366)
  })

  it('Mar 1 shifts by leap status', () => {
    expect(dayOfYear('2020-03-01')).toBe(61) // leap: 31 + 29 + 1
    expect(dayOfYear('2021-03-01')).toBe(60) // non-leap: 31 + 28 + 1
  })
})

describe('monthOfYear', () => {
  it('January is 0', () => {
    expect(monthOfYear('2020-01-15')).toBe(0)
  })

  it('March is 2', () => {
    expect(monthOfYear('2020-03-15')).toBe(2)
  })

  it('December is 11', () => {
    expect(monthOfYear('2020-12-31')).toBe(11)
  })
})
