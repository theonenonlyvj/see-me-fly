import CardFrame from '../components/CardFrame'
import { byWeekday, WEEKDAY_LABELS } from '../../engine/stats'
import { flightsByWeekday } from '../lib/flight-filters'
import type { CardContext, CardDef } from './registry'

const ACCENT = '#0fb5ae'
const GRAD = 'linear-gradient(90deg, #0fb5ae, #4fd6cf)'
const SOFT = '#dcf6f3'

export const dayOfWeekCard: CardDef = {
  id: 'dayOfWeek',
  title: 'Your week',
  group: 'creative',
  accent: ACCENT,
  icon: '🗓️',
  render: ({ model, overlay }: CardContext) => {
    const counts = byWeekday(model!.scoped)
    const total = counts.reduce((a, b) => a + b, 0)
    const peak = Math.max(...counts, 1)
    const busiest = counts.indexOf(Math.max(...counts))
    const weekdayShare = total > 0 ? Math.round((counts.slice(0, 5).reduce((a, b) => a + b, 0) / total) * 100) : 0
    return (
      <CardFrame title="Your week" eyebrow="Day-of-week rhythm" accent={ACCENT} accentGrad={GRAD} accentSoft={SOFT} icon="🗓️"
        onTitleClick={() => overlay?.openFlights('All flights', model!.scoped)}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {counts.map((c, i) => (
            <div key={i}
              onClick={c > 0 && overlay ? () => overlay.openFlights(`${WEEKDAY_LABELS[i]} flights`, flightsByWeekday(model!.scoped, i)) : undefined}
              role={c > 0 && overlay ? 'button' : undefined}
              style={{ display: 'grid', gridTemplateColumns: '36px 1fr auto', alignItems: 'center', gap: 11, cursor: c > 0 && overlay ? 'pointer' : 'default' }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: i >= 5 ? 'var(--ink-2)' : 'var(--ink)' }}>{WEEKDAY_LABELS[i]}</span>
              <div style={{ height: 14, borderRadius: 999, background: SOFT, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(c / peak) * 100}%`, borderRadius: 999, background: GRAD, boxShadow: `0 0 12px -3px ${ACCENT}` }} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: 'var(--ink)' }}>{c}</span>
            </div>
          ))}
        </div>
        <p style={{ marginTop: 14, fontSize: 11.5, color: 'var(--ink-2)', fontStyle: 'italic' }}>
          Busiest: <b style={{ color: ACCENT }}>{WEEKDAY_LABELS[busiest]}</b> · weekdays are {weekdayShare}% of all flights.
        </p>
      </CardFrame>
    )
  },
}
