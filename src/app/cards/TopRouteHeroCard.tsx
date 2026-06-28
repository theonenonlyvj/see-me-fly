import CardFrame from '../components/CardFrame'
import { displayRouteString } from '../lib/places'
import { flightsByRouteKey } from '../lib/flight-filters'
import { fmtInt } from '../lib/format'
import type { CardContext, CardDef } from './registry'

const ACCENT = '#ff2fa8'
const GRAD = 'linear-gradient(90deg, #ff2fa8, #ff7a14)'
const SOFT = '#ffe3f4'

export const topRouteHeroCard: CardDef = {
  id: 'topRouteHero',
  title: 'Your #1 route',
  group: 'creative',
  accent: ACCENT,
  icon: '🛣️',
  render: ({ model, settings, overlay }: CardContext) => {
    const top = model!.byRoute[0]
    const total = model!.totals.count
    return (
      <CardFrame title="Your #1 route" eyebrow="The corridor of your life" accent={ACCENT} accentGrad={GRAD} accentSoft={SOFT} icon="🛣️">
        {!top ? (
          <p style={{ color: 'var(--ink-2)' }}>No routes in this view.</p>
        ) : (() => {
          const pct = total > 0 ? (top.count / total) * 100 : 0
          const label = displayRouteString(top.key, settings)
          return (
            <div onClick={overlay ? () => overlay.openFlights(label, flightsByRouteKey(model!.scoped, top.key, settings)) : undefined}
              role={overlay ? 'button' : undefined} style={{ cursor: overlay ? 'pointer' : 'default' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 72, lineHeight: 0.9, background: GRAD, WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', color: 'transparent', fontVariantNumeric: 'tabular-nums' }}>
                {pct.toFixed(1)}%
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-2)', marginTop: 2 }}>of all your flights are on one route</div>
              <div style={{ marginTop: 16, fontSize: 22, fontWeight: 800, color: 'var(--ink)' }}>{label}</div>
              <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 3 }}>{fmtInt(top.count)} flights · {fmtInt(Math.round(top.miles))} mi logged</div>
            </div>
          )
        })()}
      </CardFrame>
    )
  },
}
