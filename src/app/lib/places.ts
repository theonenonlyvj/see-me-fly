import { groups, lookupAirport } from '../../engine/reference'
import { homeKeys } from '../../engine/home'
import type { Settings } from '../../engine'

/** group name -> member airport codes, e.g. "Dallas" -> ["DFW","DAL"] */
const membersByName = new Map<string, string[]>()
for (const g of groups) membersByName.set(g.name, g.airports)

/**
 * The configured home, rendered in the CURRENT token space (group name when grouping is on).
 * Date-less consumer ⇒ uses the most-recent era's primary key via `homeKeys` (covers the legacy
 * single `home` too). Retained for any single-reference home display.
 */
export function homeKey(settings: Settings): string | null {
  return homeKeys(settings).primaryKey
}

/** Decorate a route/airport endpoint so the code is always visible:
 *  a metro group name gains its member codes — "Dallas" -> "Dallas (DFW/DAL)";
 *  an airport code gains its city — "AUS" -> "Austin (AUS)" (falls back to the bare code). */
export function displayEndpoint(token: string): string {
  const members = membersByName.get(token)
  if (members) return `${token} (${members.join('/')})`
  const ap = lookupAirport(token)
  return ap?.municipality ? `${ap.municipality} (${token})` : token
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
    // Home leads. An endpoint orders first if its key is in the date-less home UNION
    // (`homeKeys().keys` covers every era + the legacy single `home`). If BOTH endpoints
    // are home keys, the tiebreak favors the most-recent era's `primaryKey`; otherwise the
    // single home key wins over the non-home one. (Keys here are already in the current
    // token space — group names when grouping is on — matching how route keys are built.)
    const { keys, primaryKey } = homeKeys(settings)
    const aHome = keys.has(a)
    const bHome = keys.has(b)
    const bLeads = bHome && (!aHome || (primaryKey != null && b === primaryKey && a !== primaryKey))
    if (bLeads) [a, b] = [b, a]
  }
  return { left: displayEndpoint(a), right: displayEndpoint(b), sep, directed }
}

/** Convenience: the full decorated, home-first route label as one string. */
export function displayRouteString(key: string, settings: Settings): string {
  const p = displayRoute(key, settings)
  return p ? `${p.left} ${p.sep} ${p.right}` : key
}
