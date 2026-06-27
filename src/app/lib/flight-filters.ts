import type { EnrichedFlight, Settings } from '../../engine'
import { airportKey, routeKey } from '../../engine/normalize'

/** Most-recent-first ordering for flight lists. */
export function sortRecent(flights: EnrichedFlight[]): EnrichedFlight[] {
  return [...flights].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.rawIndex - a.rawIndex))
}

/** Flights touching a country (origin or, for non-local flights, destination). */
export function flightsByCountry(flights: EnrichedFlight[], code: string): EnrichedFlight[] {
  return flights.filter((f) => f.resolved && (f.from?.country === code || (!f.isLocalFlight && f.to?.country === code)))
}

/** Flights touching an airport DISPLAY key (group name or code), honoring grouping. */
export function flightsByAirportKey(flights: EnrichedFlight[], key: string, settings: Settings): EnrichedFlight[] {
  return flights.filter((f) => {
    if (!f.resolved) return false
    if (airportKey(f.fromCode, settings.groupAirports) === key) return true
    return !f.isLocalFlight && airportKey(f.toCode, settings.groupAirports) === key
  })
}

/** Flights touching an exact airport code (origin or destination). */
export function flightsByAirportCode(flights: EnrichedFlight[], code: string): EnrichedFlight[] {
  return flights.filter((f) => f.resolved && (f.fromCode === code || (!f.isLocalFlight && f.toCode === code)))
}

/** Flights touching a specific resolved airport (by stable ident). */
export function flightsByAirportIdent(flights: EnrichedFlight[], ident: string): EnrichedFlight[] {
  return flights.filter((f) => f.resolved && (f.from?.ident === ident || (!f.isLocalFlight && f.to?.ident === ident)))
}

/** Flights touching an ISO region (state/province) code, e.g. "US-TX". */
export function flightsByRegion(flights: EnrichedFlight[], region: string): EnrichedFlight[] {
  return flights.filter((f) => f.resolved && (f.from?.region === region || (!f.isLocalFlight && f.to?.region === region)))
}

/** Flights flown by a specific tail number (same physical aircraft). */
export function flightsByTail(flights: EnrichedFlight[], tail: string): EnrichedFlight[] {
  return flights.filter((f) => f.tail === tail)
}

/** Flights on a given airline (by resolved name). */
export function flightsByAirline(flights: EnrichedFlight[], name: string): EnrichedFlight[] {
  return flights.filter((f) => f.airlineName === name)
}

/** Flights on a given route key (respects grouping + directionality settings). */
export function flightsByRouteKey(flights: EnrichedFlight[], key: string, settings: Settings): EnrichedFlight[] {
  return flights.filter((f) => routeKey(f, settings) === key)
}

/** Intercontinental flights crossing a given (unordered) continent pair, e.g. "EU|NA". */
export function flightsByContinentPair(flights: EnrichedFlight[], pair: string): EnrichedFlight[] {
  return flights.filter((f) =>
    f.resolved && f.from && f.to && f.from.continent !== f.to.continent &&
    [f.from.continent, f.to.continent].sort().join('|') === pair)
}
