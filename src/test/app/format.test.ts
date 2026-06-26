import { describe, it, expect } from 'vitest'
import { fmtInt, fmtMiles, fmtDuration } from '../../app/lib/format'

describe('format', () => {
  it('fmtInt groups thousands', () => { expect(fmtInt(1418)).toBe('1,418') })
  it('fmtMiles appends unit', () => { expect(fmtMiles(802)).toBe('802 mi') })
  it('fmtDuration h+m', () => { expect(fmtDuration(780)).toBe('13h 0m') })
  it('fmtDuration sub-hour', () => { expect(fmtDuration(45)).toBe('45m') })
  it('fmtDuration null', () => { expect(fmtDuration(null)).toBe('—') })
})
