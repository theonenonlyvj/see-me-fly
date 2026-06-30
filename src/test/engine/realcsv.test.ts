import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { buildModel, DEFAULT_SETTINGS } from '../../engine'

const here = dirname(fileURLToPath(import.meta.url))
const path = resolve(here, '../fixtures/real-sample.csv')
const TODAY = '2026-06-25'

describe.skipIf(!existsSync(path))('real Flighty export smoke test', () => {
  const csv = readFileSync(path, 'utf8')
  const m = buildModel(csv, DEFAULT_SETTINGS, TODAY)

  it('parses ~1800 rows with a valid header', () => {
    expect(m.headerOk).toBe(true)
    expect(m.all.length).toBeGreaterThan(1700)
  })
  it('resolves essentially every airport (near-zero unknowns; RPJ resolves)', () => {
    const unknownCodes = new Set(m.unresolved.flatMap((f) => [f.fromCode, f.toCode]).filter((c) => {
      // only count codes that truly didn't resolve
      return m.all.some((x) => (x.fromCode === c && !x.from) || (x.toCode === c && !x.to))
    }))
    expect(unknownCodes.size).toBeLessThanOrEqual(2)
    expect(m.flown.some((f) => f.fromCode === 'RPJ' && f.durationMin === 20)).toBe(true)
  })
  it('produces no negative durations', () => {
    expect(m.flown.every((f) => f.durationMin === null || f.durationMin >= 0)).toBe(true)
  })
  it('Dallas is the top airport group with home-exclusion off (most-visited overall)', () => {
    const incHome = buildModel(csv, { ...DEFAULT_SETTINGS, excludeHomeFromRankings: false }, TODAY)
    expect(incHome.byAirport[0].key).toBe('Dallas')
  })
  it('with home DFW + home-exclusion on, Dallas is dropped from the ranking and a non-home airport leads', () => {
    // Default home is now UNSET (friend-ready); set DFW explicitly. excludeHomeFromRankings is on
    // by default, so byAirport drops the home endpoint per-flight (date-aware) and Dallas no longer
    // appears in the ranking.
    const dfw = buildModel(csv, { ...DEFAULT_SETTINGS, home: 'DFW' }, TODAY)
    expect(dfw.byAirport.some((a) => a.key === 'Dallas')).toBe(false)
    expect(dfw.byAirport[0].key).not.toBe('Dallas')
  })
})
