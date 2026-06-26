import type { EnrichedFlight } from './types'

export type RouteClass = 'intra-state' | 'intra-country' | 'intra-continent' | 'intercontinental'

export function classifyRoute(f: EnrichedFlight): RouteClass | null {
  if (!f.resolved || f.isLocalFlight || !f.from || !f.to) return null
  if (f.from.continent !== f.to.continent) return 'intercontinental'
  if (f.from.country !== f.to.country) return 'intra-continent'
  if (f.from.region !== f.to.region) return 'intra-country'
  return 'intra-state'
}
