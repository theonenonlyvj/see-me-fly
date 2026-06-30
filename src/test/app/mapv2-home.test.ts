import { describe, it, expect } from 'vitest'
import { emphasizedPrimaryKey } from '../../app/cards/MapV2Card'
import { DEFAULT_SETTINGS, type Settings } from '../../engine'

// Eras: DEN (2019-06-01) → DFW/DAL (2021-02-04). Grouping ON (default): airportKey('DEN')='DEN',
// airportKey('DFW')='Dallas'.
const settings: Settings = {
  ...DEFAULT_SETTINGS,
  home: null,
  homeHistory: [
    { start: '2019-06-01', airports: ['DEN'] },
    { start: '2021-02-04', airports: ['DFW', 'DAL'] },
  ],
}

describe('emphasizedPrimaryKey (SHOULD-FIX 5)', () => {
  it('all-time scope emphasizes the most-recent home (Dallas group)', () => {
    expect(emphasizedPrimaryKey(settings, null)).toBe('Dallas')
  })

  it('a 2019 scope emphasizes the 2019-era home (DEN), not today\'s DFW', () => {
    expect(emphasizedPrimaryKey(settings, 2019)).toBe('DEN')
  })

  it('a 2022 scope emphasizes the then-current home (Dallas group)', () => {
    expect(emphasizedPrimaryKey(settings, 2022)).toBe('Dallas')
  })

  it('falls back to the legacy single home when there is no timeline', () => {
    const legacy: Settings = { ...DEFAULT_SETTINGS, home: 'DFW', homeHistory: [] }
    // even with a year scope, no timeline → the single home key wins
    expect(emphasizedPrimaryKey(legacy, 2019)).toBe('Dallas')
    expect(emphasizedPrimaryKey(legacy, null)).toBe('Dallas')
  })

  it('returns null when there is no home at all', () => {
    const none: Settings = { ...DEFAULT_SETTINGS, home: null, homeHistory: [] }
    expect(emphasizedPrimaryKey(none, 2019)).toBeNull()
  })
})
