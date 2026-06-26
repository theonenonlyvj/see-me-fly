import CardFrame from '../components/CardFrame'
import BarList from '../components/charts/BarList'
import type { BarRow } from '../components/charts/BarList'
import { superDomestic } from '../../engine/stats'
import { displayRouteString } from '../lib/places'
import type { Settings } from '../../engine'
import type { CardContext, CardDef } from './registry'

const ACCENT      = '#ff7a14'
const ACCENT_GRAD = 'linear-gradient(90deg, #ff7a14, #ffb347)'
const ACCENT_SOFT = '#fff3e6'

const TIER_LABELS: Record<string, string> = {
  'intra-state':     'Intra-state',
  'intra-country':   'Intra-country',
  'intra-continent': 'Intra-continent',
}

function TierSection({ tier, routes, settings }: { tier: string; routes: { key: string; count: number }[]; settings: Settings }) {
  const rows: BarRow[] = routes.slice(0, 6).map((r) => ({ label: displayRouteString(r.key, settings), value: r.count }))
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{
        fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase',
        color: ACCENT, marginBottom: 10,
      }}>
        {TIER_LABELS[tier] ?? tier}
      </div>
      <BarList
        rows={rows}
        max={6}
        formatValue={(n) => `${n}`}
        accent={ACCENT}
        accentGrad={ACCENT_GRAD}
        accentSoft={ACCENT_SOFT}
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
            <TierSection key={t.tier} tier={t.tier} routes={t.routes} settings={ctx.settings} />
          ))
        )}
      </CardFrame>
    )
  },
}
