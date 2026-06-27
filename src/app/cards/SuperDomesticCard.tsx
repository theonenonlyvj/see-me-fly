import CardFrame from '../components/CardFrame'
import BarList from '../components/charts/BarList'
import type { BarRow } from '../components/charts/BarList'
import { superDomestic } from '../../engine/stats'
import { displayRouteString } from '../lib/places'
import { flightsByRouteKey, flightsByDomesticTier } from '../lib/flight-filters'
import { lookupAirport, regionName } from '../../engine/reference'
import type { Settings } from '../../engine'
import type { CardContext, CardDef } from './registry'
import type { Model } from '../state/useModel'
import type { OverlayApi } from '../components/Overlay'

const ACCENT      = '#ff7a14'
const ACCENT_GRAD = 'linear-gradient(90deg, #ff7a14, #ffb347)'
const ACCENT_SOFT = '#fff3e6'

function TierSection({ tier, label, routes, settings, model, overlay }: {
  tier: 'intra-state' | 'intra-country' | 'intra-continent'
  label: string
  routes: { key: string; count: number }[]
  settings: Settings
  model: Model
  overlay?: OverlayApi
}) {
  const rows: BarRow[] = routes.map((r) => ({ label: displayRouteString(r.key, settings), value: r.count, id: r.key }))
  return (
    <div style={{ marginBottom: 22 }}>
      <div
        onClick={() => overlay?.openFlights(label, flightsByDomesticTier(model!.scoped, tier, settings))}
        role={overlay ? 'button' : undefined}
        style={{
          fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase',
          color: ACCENT, marginBottom: 10, cursor: overlay ? 'pointer' : undefined,
          display: 'flex', alignItems: 'center', gap: 7,
        }}>
        {label}
        {overlay && <span style={{ fontSize: 9.5, opacity: 0.7, letterSpacing: 0 }}>map ↗</span>}
      </div>
      <BarList
        rows={rows}
        max={5}
        seeAllTitle={label}
        formatValue={(n) => `${n}`}
        accent={ACCENT}
        accentGrad={ACCENT_GRAD}
        accentSoft={ACCENT_SOFT}
        onRowClick={(row) => row.id && overlay?.openFlights(displayRouteString(row.id, settings), flightsByRouteKey(model!.scoped, row.id, settings))}
      />
    </div>
  )
}

export const superDomesticCard: CardDef = {
  id: 'superDomestic',
  title: 'Super-domestic',
  group: 'core',
  accent: ACCENT,
  icon: '🏠',
  render: (ctx: CardContext) => {
    const tiers = superDomestic(ctx.model!.scoped, ctx.settings)
    const homeRegion = ctx.settings.home ? lookupAirport(ctx.settings.home)?.region : undefined
    const homeState = homeRegion ? regionName(homeRegion) : null
    const labelFor = (tier: string): string =>
      tier === 'intra-state' ? (homeState ? `Within ${homeState}` : 'Within your home state')
      : tier === 'intra-country' ? 'Within a country'
      : 'Within a continent'

    return (
      <CardFrame
        title="Super-domestic"
        eyebrow="Close to home"
        accent={ACCENT}
        accentGrad={ACCENT_GRAD}
        accentSoft={ACCENT_SOFT}
        icon="🏠"
      >
        {tiers.length === 0 ? (
          <p style={{ color: 'var(--ink-2)' }}>No domestic routes found.</p>
        ) : (
          tiers.map((t) => (
            <TierSection key={t.tier} tier={t.tier} label={labelFor(t.tier)} routes={t.routes} settings={ctx.settings} model={ctx.model} overlay={ctx.overlay} />
          ))
        )}
      </CardFrame>
    )
  },
}
