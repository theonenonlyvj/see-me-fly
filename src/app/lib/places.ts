import { groups } from '../../engine/reference'
import { airportKey } from '../../engine/normalize'
import type { Settings } from '../../engine'

/** group name -> member airport codes, e.g. "Dallas" -> ["DFW","DAL"] */
const membersByName = new Map<string, string[]>()
for (const g of groups) membersByName.set(g.name, g.airports)

/** The configured home, rendered in the CURRENT token space (group name when grouping is on). */
export function homeKey(settings: Settings): string | null {
  if (!settings.home) return null
  return airportKey(settings.home, settings.groupAirports)
}

/** Decorate a route/airport endpoint: a metro group name gains its member codes —
 *  "Dallas" -> "Dallas (DFW/DAL)". A plain airport code is returned unchanged. */
export function displayEndpoint(token: string): string {
  const members = membersByName.get(token)
  return members ? `${token} (${members.join('/')})` : token
}

export interface RouteParts { left: string; right: string; sep: '↔' | '→'; directed: boolean }

/** Split a route key "A↔B" / "A→B" into endpoints. Home leads for UNDIRECTED (↔) keys only —
 *  a directed (→) key encodes a real direction and is never reversed. Endpoints are decorated. */
export function displayRoute(key: string, settings: Settings): RouteParts | null {
  const sep: '↔' | '→' | null = key.includes('↔') ? '↔' : key.includes('→') ? '→' : null
  if (!sep) return null
  const parts = key.split(sep).map((s) => s.trim())
  if (parts.length !== 2) return null
  let [a, b] = parts
  const directed = sep === '→'
  if (!directed) {
    const hk = homeKey(settings)
    if (hk && b === hk && a !== hk) [a, b] = [b, a]
  }
  return { left: displayEndpoint(a), right: displayEndpoint(b), sep, directed }
}

/** Convenience: the full decorated, home-first route label as one string. */
export function displayRouteString(key: string, settings: Settings): string {
  const p = displayRoute(key, settings)
  return p ? `${p.left} ${p.sep} ${p.right}` : key
}
