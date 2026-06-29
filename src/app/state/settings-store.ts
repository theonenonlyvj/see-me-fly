import { DEFAULT_SETTINGS, type Settings } from '../../engine'

export const SETTINGS_KEY = 'flightviz:settings:v1'
export const SCHEMA_VERSION = 1

function safeStorage(storage?: Storage): Storage | null {
  if (storage) return storage
  try { return window.localStorage } catch { return null }
}

export function loadSettings(storage?: Storage): Settings {
  const s = safeStorage(storage)
  if (!s) return DEFAULT_SETTINGS
  const raw = s.getItem(SETTINGS_KEY)
  if (!raw) return DEFAULT_SETTINGS
  try {
    const parsed = JSON.parse(raw) as { schemaVersion?: number; settings?: Partial<Settings> }
    const stored = parsed?.settings ?? {}
    return {
      ...DEFAULT_SETTINGS,
      ...stored,
      // Coerce the home-by-date arrays defensively: an old localStorage blob (or a malformed
      // edit) may carry these as undefined/non-array, which would break array consumers.
      homeHistory: Array.isArray(stored.homeHistory) ? stored.homeHistory : [],
      groundLinks: Array.isArray(stored.groundLinks) ? stored.groundLinks : [],
      duration: { ...DEFAULT_SETTINGS.duration, ...(stored.duration ?? {}) },
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings: Settings, storage?: Storage): void {
  const s = safeStorage(storage)
  if (!s) return
  s.setItem(SETTINGS_KEY, JSON.stringify({ schemaVersion: SCHEMA_VERSION, settings }))
}

export function resetSettings(storage?: Storage): void {
  const s = safeStorage(storage)
  if (!s) return
  s.removeItem(SETTINGS_KEY)
}
