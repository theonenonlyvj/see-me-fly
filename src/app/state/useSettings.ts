import { useCallback, useState } from 'react'
import { loadSettings, saveSettings, resetSettings } from './settings-store'
import { DEFAULT_SETTINGS, type Settings } from '../../engine'

export function useSettings(): [Settings, (patch: Partial<Settings>) => void, () => void] {
  const [settings, setSettings] = useState<Settings>(() => loadSettings())

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next: Settings = {
        ...prev,
        ...patch,
        duration: { ...prev.duration, ...(patch.duration ?? {}) },
      }
      saveSettings(next)
      return next
    })
  }, [])

  const reset = useCallback(() => {
    resetSettings()
    setSettings(DEFAULT_SETTINGS)
  }, [])

  return [settings, update, reset]
}
