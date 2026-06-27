import { describe, it, expect } from 'vitest'
import { airportKey, routeKey } from '../../engine/normalize'
import { enrichFlight } from '../../engine/enrich'
import { parseFlightyCsv, REQUIRED_COLUMNS } from '../../engine/parse'
import { DEFAULT_DURATION_CONSTANTS as C } from '../../engine/constants'
import type { Settings } from '../../engine/types'

const H = REQUIRED_COLUMNS.join(',')
const f = (from: string, to: string) =>
  enrichFlight(parseFlightyCsv([H, `2018-01-01,AAL,1,${from},${to},,,,,false,,2018-01-01T09:00,,,,,,,,Boeing 737,,,,,,,,,,,`].join('\n')).rows[0], '2026-06-25', C)

const settings = (over: Partial<Settings>): Settings => ({
  groupAirports: false, explicitlyUnique: true, includeCanceled: false, excludeBeforeDate: null, home: null, layoverMaxHours: 5, excludeDayTrips: true, splitCountriesByState: [], groupAircraftFamilies: false, duration: C, ...over,
})

describe('normalize', () => {
  it('airportKey groups when enabled', () => {
    expect(airportKey('DFW', true)).toBe('Dallas')
    expect(airportKey('DFW', false)).toBe('DFW')
    expect(airportKey('AUS', true)).toBe('AUS') // not in any group
  })

  it('§5.2: group on + unique off collapses DFW->SFO, OAK->DAL, SFO->DFW to one route', () => {
    const s = settings({ groupAirports: true, explicitlyUnique: false })
    const keys = new Set([routeKey(f('DFW', 'SFO'), s), routeKey(f('OAK', 'DAL'), s), routeKey(f('SFO', 'DFW'), s)])
    expect(keys.size).toBe(1)
  })

  it('group off + unique on keeps all three distinct', () => {
    const s = settings({ groupAirports: false, explicitlyUnique: true })
    const keys = new Set([routeKey(f('DFW', 'SFO'), s), routeKey(f('OAK', 'DAL'), s), routeKey(f('SFO', 'DFW'), s)])
    expect(keys.size).toBe(3)
  })

  it('returns null for a grouped self-loop (DAL->DFW under grouping)', () => {
    const s = settings({ groupAirports: true, explicitlyUnique: true })
    expect(routeKey(f('DAL', 'DFW'), s)).toBeNull()
  })
})
