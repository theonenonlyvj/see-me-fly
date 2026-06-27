import { describe, it, expect, beforeEach } from 'vitest'
import { loadSettings, saveSettings, resetSettings, SETTINGS_KEY } from '../../app/state/settings-store'
import { DEFAULT_SETTINGS } from '../../engine'

// minimal in-memory Storage
function mem(): Storage {
  const m = new Map<string, string>()
  return {
    get length() { return m.size },
    clear: () => m.clear(),
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, v),
  }
}

describe('settings-store', () => {
  let s: Storage
  beforeEach(() => { s = mem() })

  it('returns defaults when nothing stored', () => {
    expect(loadSettings(s)).toEqual(DEFAULT_SETTINGS)
  })

  it('round-trips saved settings', () => {
    const next = { ...DEFAULT_SETTINGS, groupAirports: false, excludeBeforeDate: '2001-01-01' }
    saveSettings(next, s)
    expect(loadSettings(s)).toEqual(next)
  })

  it('deep-merges partial/legacy blobs over current defaults', () => {
    s.setItem(SETTINGS_KEY, JSON.stringify({ schemaVersion: 1, settings: { explicitlyUnique: true } }))
    const loaded = loadSettings(s)
    expect(loaded.explicitlyUnique).toBe(true)
    expect(loaded.groupAirports).toBe(DEFAULT_SETTINGS.groupAirports) // filled
    expect(loaded.duration).toEqual(DEFAULT_SETTINGS.duration) // nested filled
    expect(loaded.splitCountriesByState).toEqual([]) // new field defaults in for legacy blobs
    expect(loaded.groupAircraftFamilies).toBe(false) // new field defaults in for legacy blobs
  })

  it('ignores a malformed blob and returns defaults', () => {
    s.setItem(SETTINGS_KEY, 'not json{')
    expect(loadSettings(s)).toEqual(DEFAULT_SETTINGS)
  })

  it('reset removes the key', () => {
    saveSettings(DEFAULT_SETTINGS, s)
    resetSettings(s)
    expect(s.getItem(SETTINGS_KEY)).toBeNull()
  })
})
