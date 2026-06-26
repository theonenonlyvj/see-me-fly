// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSettings } from '../../app/state/useSettings'
import { useModel } from '../../app/state/useModel'
import { DEFAULT_SETTINGS } from '../../engine'
import { REQUIRED_COLUMNS } from '../../engine/parse'

const csv = [REQUIRED_COLUMNS.join(','), '2018-01-01,AAL,1,DFW,AUS,,,,,false,,2018-01-01T09:00,,,,,,,,Boeing 737,,,,,,,,,,,'].join('\n')

describe('useSettings', () => {
  beforeEach(() => localStorage.clear())
  it('starts at defaults and updates + persists', () => {
    const { result } = renderHook(() => useSettings())
    expect(result.current[0]).toEqual(DEFAULT_SETTINGS)
    act(() => result.current[1]({ groupAirports: false }))
    expect(result.current[0].groupAirports).toBe(false)
    expect(JSON.parse(localStorage.getItem('flightviz:settings:v1')!).settings.groupAirports).toBe(false)
  })
})

describe('useModel', () => {
  it('returns null without csv, a model with csv', () => {
    const { result, rerender } = renderHook(({ t }: { t: string | null }) => useModel(t, DEFAULT_SETTINGS, '2026-06-25'), { initialProps: { t: null as string | null } })
    expect(result.current).toBeNull()
    rerender({ t: csv })
    expect(result.current!.totals.count).toBe(1)
  })
})
