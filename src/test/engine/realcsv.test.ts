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

  it('parses essentially every export row (no large parse drop)', () => {
    expect(m.headerOk).toBe(true)
    // Strong-but-private guardrail: derive the expected count from the file itself rather than
    // hard-coding the owner's flight total. Catches a parser regression that silently drops rows.
    const dataRows = csv.trim().split(/\r?\n/).length - 1 // minus header
    expect(dataRows).toBeGreaterThan(100)
    expect(m.all.length).toBeGreaterThan(dataRows * 0.95)
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
  it('produces a non-empty most-visited airport ranking with home-exclusion off', () => {
    const incHome = buildModel(csv, { ...DEFAULT_SETTINGS, excludeHomeFromRankings: false }, TODAY)
    expect(incHome.byAirport.length).toBeGreaterThan(0)
    expect(typeof incHome.byAirport[0].key).toBe('string')
  })
  it('with a home set + home-exclusion on, the home metro is dropped from the top of the ranking', () => {
    // Default home is UNSET (friend-ready). Pick the single most-flown departure airport from the
    // data as the home, then verify that with excludeHomeFromRankings on (the default), byAirport
    // drops that home's metro per-flight (date-aware) so the top of the ranking changes vs. the
    // home-included ranking.
    const incHome = buildModel(csv, { ...DEFAULT_SETTINGS, excludeHomeFromRankings: false }, TODAY)
    const counts = new Map<string, number>()
    for (const f of m.flown) counts.set(f.fromCode, (counts.get(f.fromCode) ?? 0) + 1)
    const homeCode = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
    expect(homeCode).toBeTruthy()
    const withHome = buildModel(csv, { ...DEFAULT_SETTINGS, home: homeCode! }, TODAY)
    // The home metro led the home-included ranking; with exclusion on it must no longer lead.
    expect(withHome.byAirport[0].key).not.toBe(incHome.byAirport[0].key)
  })
})
