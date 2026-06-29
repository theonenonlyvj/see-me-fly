import CardFrame from '../components/CardFrame'
import ProportionBar from '../components/charts/ProportionBar'
import { homeDistanceTiers, HOME_TIER_LABELS, type HomeTier } from '../../engine/stats'
import { hasHome } from '../../engine/home'
import { flightsByDomesticTier, flightsIntercontinental } from '../lib/flight-filters'
import type { CardContext, CardDef } from './registry'

const ACCENT = '#3b82f6'
const GRAD = 'linear-gradient(90deg, #3b82f6, #60a5fa)'
const SOFT = '#e6efff'

const TIER_COLORS: Record<HomeTier, string> = {
  'intra-state': '#22c55e', 'intra-country': '#3b82f6', 'intra-continent': '#f59e0b', intercontinental: '#ef4444',
}

export const howFarFromHomeCard: CardDef = {
  id: 'howFarFromHome',
  title: 'How far from home',
  group: 'core',
  accent: ACCENT,
  icon: '🏠',
  render: ({ model, settings, overlay }: CardContext) => {
    const tiers = homeDistanceTiers(model!.scoped, settings)
    const segments = tiers.map((t) => ({ label: HOME_TIER_LABELS[t.tier], value: t.count, color: TIER_COLORS[t.tier], id: t.tier }))
    return (
      <CardFrame title="How far from home" eyebrow="Close vs. far" accent={ACCENT} accentGrad={GRAD} accentSoft={SOFT} icon="🏠">
        {!hasHome(settings) ? (
          <p style={{ color: 'var(--ink-2)' }}>Set a home airport in Settings to see how far each flight took you from home.</p>
        ) : (<>
        <ProportionBar
          segments={segments}
          formatValue={(n) => `${n}`}
          onSegment={(s) => {
            if (!overlay) return
            const flights = s.id === 'intercontinental'
              ? flightsIntercontinental(model!.scoped)
              : flightsByDomesticTier(model!.scoped, s.id as 'intra-state' | 'intra-country' | 'intra-continent', settings)
            overlay.openFlights(`${s.label} flights`, flights)
          }}
        />
        <p style={{ marginTop: 14, fontSize: 11.5, color: 'var(--ink-2)', fontStyle: 'italic' }}>
          Each flight counted once, by how far it took you from the home you had then.
        </p>
        </>)}
      </CardFrame>
    )
  },
}
