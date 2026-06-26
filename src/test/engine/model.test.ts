import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { buildModel, DEFAULT_SETTINGS } from '../../engine'
import type { Settings } from '../../engine/types'

const here = dirname(fileURLToPath(import.meta.url))
const csv = readFileSync(resolve(here, '../fixtures/golden.csv'), 'utf8')
const TODAY = '2026-06-25'
const S = (over: Partial<Settings> = {}): Settings => ({ ...DEFAULT_SETTINGS, ...over })

describe('golden model', () => {
  it('excludes the future row from flown stats', () => {
    const m = buildModel(csv, S(), TODAY)
    expect(m.all).toHaveLength(12)
    expect(m.flown.some((f) => f.date === '2026-08-22')).toBe(false)
  })
  it('excludes canceled by default', () => {
    const m = buildModel(csv, S(), TODAY)
    expect(m.flown.some((f) => f.canceled)).toBe(false)
  })
  it('surfaces the unknown ZZZ airport, not dropped', () => {
    const m = buildModel(csv, S(), TODAY)
    expect(m.unresolved.some((f) => f.fromCode === 'ZZZ')).toBe(true)
  })
  it('RPJ local flight: distance 0, ~20min, counts as a flight + airport touch, no route', () => {
    const m = buildModel(csv, S({ groupAirports: false }), TODAY)
    const rpj = m.flown.find((f) => f.fromCode === 'RPJ')!
    expect(rpj.distanceMi).toBe(0)
    expect(rpj.durationMin).toBe(20)
    expect(m.byAirport.find((a) => a.key === 'RPJ')!.count).toBe(1)
    expect(m.byRoute.some((r) => r.key.includes('RPJ'))).toBe(false)
  })
  it('§5.2: group on + unique off collapses the 3 Bay/Dallas legs to 1 route', () => {
    const m = buildModel(csv, S({ groupAirports: true, explicitlyUnique: false }), TODAY)
    const r = m.byRoute.filter((x) => x.key.includes('Dallas') && x.key.includes('SF Bay'))
    expect(r).toHaveLength(1)
    expect(r[0].count).toBe(3)
  })
  it('diverted row routes DFW->SPS', () => {
    const m = buildModel(csv, S({ groupAirports: false }), TODAY)
    expect(m.flown.find((f) => f.flightNumber === '301')!.toCode).toBe('SPS')
  })
})
