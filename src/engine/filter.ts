import type { EnrichedFlight, Settings } from './types'

export function applyFilters(
  flights: EnrichedFlight[],
  settings: Settings,
  _today: string,
  scopeYear?: number,
): EnrichedFlight[] {
  return flights.filter((f) => {
    if (f.excluded) return false
    if (!f.flown) return false
    if (f.canceled && !settings.includeCanceled) return false
    if (settings.excludeBeforeDate && f.date < settings.excludeBeforeDate) return false
    if (scopeYear !== undefined && f.year !== scopeYear) return false
    return true
  })
}
