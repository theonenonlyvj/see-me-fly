import { useMemo } from 'react'
import { buildModel, type Settings } from '../../engine'

export type Model = ReturnType<typeof buildModel>

export function useModel(csvText: string | null, settings: Settings, today: string, scopeYear?: number): Model | null {
  return useMemo(() => {
    if (csvText === null) return null
    return buildModel(csvText, settings, today, scopeYear)
  }, [csvText, settings, today, scopeYear])
}
