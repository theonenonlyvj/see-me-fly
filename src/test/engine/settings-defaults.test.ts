import { describe, it, expect } from 'vitest'
import { DEFAULT_SETTINGS } from '../../engine'

describe('DEFAULT_SETTINGS home-by-date fields', () => {
  it('ships homeHistory and groundLinks as empty arrays', () => {
    expect(DEFAULT_SETTINGS.homeHistory).toEqual([])
    expect(DEFAULT_SETTINGS.groundLinks).toEqual([])
  })

  it('a partial merge over DEFAULT_SETTINGS keeps the arrays defined (not undefined)', () => {
    const merged = { ...DEFAULT_SETTINGS, ...{ home: 'DFW' } }
    expect(merged.homeHistory).toEqual([])
    expect(merged.groundLinks).toEqual([])
    expect(merged.homeHistory).not.toBeUndefined()
    expect(merged.groundLinks).not.toBeUndefined()
  })
})
