import { describe, it, expect } from 'vitest'
import { emphasizedPrimaryKey } from '../../app/cards/MapV2Card'
import { DEFAULT_SETTINGS, type Settings } from '../../engine'

// Eras: MKE (2012-07-03) → DFW/DAL (2013-01-15). Grouping ON (default): airportKey('MKE')='MKE',
// airportKey('DFW')='Dallas'.
const settings: Settings = {
  ...DEFAULT_SETTINGS,
  home: null,
  homeHistory: [
    { start: '2012-07-03', airports: ['MKE'] },
    { start: '2013-01-15', airports: ['DFW', 'DAL'] },
  ],
}

describe('emphasizedPrimaryKey (SHOULD-FIX 5)', () => {
  it('all-time scope emphasizes the most-recent home (Dallas group)', () => {
    expect(emphasizedPrimaryKey(settings, null)).toBe('Dallas')
  })

  it('a 2012 scope emphasizes the 2012-era home (MKE), not today\'s DFW', () => {
    expect(emphasizedPrimaryKey(settings, 2012)).toBe('MKE')
  })

  it('a 2020 scope emphasizes the then-current home (Dallas group)', () => {
    expect(emphasizedPrimaryKey(settings, 2020)).toBe('Dallas')
  })

  it('falls back to the legacy single home when there is no timeline', () => {
    const legacy: Settings = { ...DEFAULT_SETTINGS, home: 'DFW', homeHistory: [] }
    // even with a year scope, no timeline → the single home key wins
    expect(emphasizedPrimaryKey(legacy, 2012)).toBe('Dallas')
    expect(emphasizedPrimaryKey(legacy, null)).toBe('Dallas')
  })

  it('returns null when there is no home at all', () => {
    const none: Settings = { ...DEFAULT_SETTINGS, home: null, homeHistory: [] }
    expect(emphasizedPrimaryKey(none, 2012)).toBeNull()
  })
})
