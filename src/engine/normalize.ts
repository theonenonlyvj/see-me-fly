import type { EnrichedFlight, Settings } from './types'
import { airportToGroup } from './reference'

export function airportKey(code: string, groupAirports: boolean): string {
  if (!groupAirports) return code
  return airportToGroup.get(code.toUpperCase()) ?? code
}

export function routeKey(f: EnrichedFlight, settings: Settings): string | null {
  if (!f.resolved || f.isLocalFlight) return null
  const a = airportKey(f.fromCode, settings.groupAirports)
  const b = airportKey(f.toCode, settings.groupAirports)
  if (a === b) return null // collapsed self-loop
  if (settings.explicitlyUnique) return `${a}→${b}`
  return [a, b].sort().join('↔')
}
