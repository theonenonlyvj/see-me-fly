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
  it('Dallas is the top airport group', () => {
    expect(m.byAirport[0].key).toBe('Dallas')
  })
})
