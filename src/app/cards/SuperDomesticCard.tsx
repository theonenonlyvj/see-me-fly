import CardFrame from '../components/CardFrame'
import BarList from '../components/charts/BarList'
import type { BarRow } from '../components/charts/BarList'
import { superDomestic } from '../../engine/stats'
import { displayRouteString } from '../lib/places'
import { flightsByRouteKey, flightsByDomesticTier } from '../lib/flight-filters'
import { lookupAirport, regionName } from '../../engine/reference'
import type { Settings } from '../../engine'
import type { CardContext, CardDef } from './registry'

type Tier = 'intra-state' | 'intra-country' | 'intra-continent'

/**
 * Distinct home-state regions across the whole timeline (each era's PRIMARY airport's region,
 * de-duped), falling back to the legacy single `home`. Drives the intra-state card title:
 * one distinct region → "Within <region>"; several → "Within your home state(s)".
 */
function homeRegions(settings: Settings): string[] {
  const codes = settings.homeHistory.length > 0
    ? settings.homeHistory.map((e) => e.airports[0]).filter(Boolean)
    : settings.home ? [settings.home] : []
  const regions = new Set<string>()
  for (const code of codes) {
    const r = lookupAirport(code)?.region
    if (r) regions.add(r)
  }
  return [...regions]
}

function labelFor(tier: Tier, settings: Settings): string {
  if (tier === 'intra-state') {
    const regions = homeRegions(settings)
    if (regions.length === 1) return `Within ${regionName(regions[0])}`
    if (regions.length > 1) return 'Within your home state(s)'
    return 'Within your home state'
  }
  return tier === 'intra-country' ? 'Within a country' : 'Within a continent'
}

function makeTierCard(tier: Tier, opts: { id: string; accent: string; grad: string; soft: string; icon: string; staticTitle: string }): CardDef {
  return {
    id: opts.id,
    title: opts.staticTitle,
    group: 'core',
    accent: opts.accent,
    icon: opts.icon,
    render: (ctx: CardContext) => {
      const label = labelFor(tier, ctx.settings)
      const tierData = superDomestic(ctx.model!.scoped, ctx.settings).find((t) => t.tier === tier)
      const routes = tierData?.routes ?? []
      const flights = flightsByDomesticTier(ctx.model!.scoped, tier, ctx.settings)
      const rows: BarRow[] = routes.map((r) => ({ label: displayRouteString(r.key, ctx.settings), value: r.count, id: r.key }))

      return (
        <CardFrame title={label} eyebrow="Close to home" accent={opts.accent} accentGrad={opts.grad} accentSoft={opts.soft} icon={opts.icon}>
          {flights.length === 0 ? (
            <p style={{ color: 'var(--ink-2)' }}>No flights in this tier.</p>
          ) : (
            <>
              <div
                onClick={() => ctx.overlay?.openFlights(label, flights)}
                role={ctx.overlay ? 'button' : undefined}
                style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 14, cursor: ctx.overlay ? 'pointer' : undefined, display: 'flex', alignItems: 'center', gap: 6 }}>
                {flights.length} flight{flights.length === 1 ? '' : 's'}
                {ctx.overlay && <span style={{ color: opts.accent, fontWeight: 800 }}>· on a map ↗</span>}
              </div>
              <BarList
                rows={rows}
                max={5}
                seeAllTitle={label}
                formatValue={(n) => `${n}`}
                accent={opts.accent}
                accentGrad={opts.grad}
                accentSoft={opts.soft}
                onRowClick={(row) => row.id && ctx.overlay?.openFlights(displayRouteString(row.id, ctx.settings), flightsByRouteKey(ctx.model!.scoped, row.id, ctx.settings))}
              />
            </>
          )}
        </CardFrame>
      )
    },
  }
}

export const domesticStateCard = makeTierCard('intra-state', {
  id: 'domesticState', accent: '#ff7a14', grad: 'linear-gradient(90deg, #ff7a14, #ffb347)', soft: '#fff3e6', icon: '🏠', staticTitle: 'Within your home state',
})
export const domesticCountryCard = makeTierCard('intra-country', {
  id: 'domesticCountry', accent: '#12c08a', grad: 'linear-gradient(90deg, #12c08a, #3ad6c0)', soft: '#ddf7ee', icon: '🏙️', staticTitle: 'Within a country',
})
export const domesticContinentCard = makeTierCard('intra-continent', {
  id: 'domesticContinent', accent: '#1aa9ff', grad: 'linear-gradient(90deg, #1aa9ff, #5ad0ff)', soft: '#e5f6ff', icon: '🗺️', staticTitle: 'Within a continent',
})
