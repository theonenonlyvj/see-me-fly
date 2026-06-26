import { describe, it, expect } from 'vitest'
import { fmtInt, fmtMiles, fmtDuration, fmtDurationDays, flagEmoji, monogram } from '../../app/lib/format'

describe('format', () => {
  it('fmtInt groups thousands', () => { expect(fmtInt(1418)).toBe('1,418') })
  it('fmtMiles appends unit', () => { expect(fmtMiles(802)).toBe('802 mi') })
  it('fmtDuration h+m', () => { expect(fmtDuration(780)).toBe('13h 0m') })
  it('fmtDuration sub-hour', () => { expect(fmtDuration(45)).toBe('45m') })
  it('fmtDuration null', () => { expect(fmtDuration(null)).toBe('—') })

  describe('fmtDurationDays', () => {
    it('returns days+hours for multi-day durations', () => {
      // 105120 min = 73 days 0 hours
      const result = fmtDurationDays(105120)
      expect(result).toMatch(/^\d+d \d+h$/)
      expect(result).toBe('73d 0h')
    })
    it('returns days+hours for ~73d 4h', () => {
      // 73d 4h = 73*24*60 + 4*60 = 105120 + 240 = 105360
      expect(fmtDurationDays(105360)).toBe('73d 4h')
    })
    it('returns just hours when less than a day', () => {
      expect(fmtDurationDays(240)).toBe('4h')
    })
    it('returns — for null', () => {
      expect(fmtDurationDays(null)).toBe('—')
    })
  })

  describe('flagEmoji', () => {
    it('US flag is non-empty', () => {
      expect(flagEmoji('US')).toBeTruthy()
    })
    it('returns empty string for unknown/invalid code', () => {
      expect(flagEmoji('')).toBe('')
      expect(flagEmoji('ZZ')).toBeTruthy() // still generates something for 2-char code
    })
    it('US flag matches regional indicator characters', () => {
      const flag = flagEmoji('US')
      expect([...flag].length).toBe(2) // two regional indicator code points
    })
  })

  describe('monogram', () => {
    it('returns 2 initials for multi-word name', () => {
      const { initials } = monogram('American Airlines')
      expect(initials).toBe('AA')
    })
    it('returns 2 chars for single-word name', () => {
      const { initials } = monogram('Delta')
      expect(initials.length).toBeLessThanOrEqual(2)
      expect(initials.length).toBeGreaterThan(0)
    })
    it('returns a non-empty color string', () => {
      const { color } = monogram('American Airlines')
      expect(color).toBeTruthy()
      expect(color).toContain('gradient')
    })
    it('is deterministic', () => {
      expect(monogram('Southwest').initials).toBe(monogram('Southwest').initials)
      expect(monogram('Southwest').color).toBe(monogram('Southwest').color)
    })
  })
})
