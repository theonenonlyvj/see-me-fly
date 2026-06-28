import CardFrame from '../components/CardFrame'
import { redEyeProfile } from '../../engine/stats'
import { flightsByDepHours } from '../lib/flight-filters'
import type { CardContext, CardDef } from './registry'

const ACCENT = '#6d5dfc'
const GRAD = 'linear-gradient(90deg, #6d5dfc, #9b8bff)'
const SOFT = '#ebe8ff'

const hourLabel = (h: number) => (h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`)

function Tile({ value, label, accent, onClick }: { value: string; label: string; accent: string; onClick?: () => void }) {
  return (
    <div onClick={onClick} role={onClick ? 'button' : undefined}
      style={{ flex: 1, minWidth: 96, background: '#fff', border: '1px solid var(--hair-2)', borderRadius: 14, padding: '13px 15px', cursor: onClick ? 'pointer' : 'default' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 30, lineHeight: 1, color: accent, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-2)', marginTop: 5 }}>{label}</div>
    </div>
  )
}

export const redEyesCard: CardDef = {
  id: 'redEyes',
  title: 'Red-eyes & early birds',
  group: 'creative',
  accent: ACCENT,
  icon: '🌙',
  render: ({ model, overlay }: CardContext) => {
    const p = redEyeProfile(model!.scoped)
    const peak = Math.max(...p.hourCounts, 1)
    return (
      <CardFrame title="Red-eyes & early birds" eyebrow="Time of day you depart" accent={ACCENT} accentGrad={GRAD} accentSoft={SOFT} icon="🌙">
        <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
          <Tile value={`${p.redEyes}`} label="Red-eyes (dep 10pm–4am)" accent={ACCENT}
            onClick={p.redEyes > 0 && overlay ? () => overlay.openFlights('Red-eye departures', flightsByDepHours(model!.scoped, [22, 23, 0, 1, 2, 3, 4])) : undefined} />
          <Tile value={`${p.dawnPatrol}`} label="Dawn patrol (5–6am)" accent={ACCENT}
            onClick={p.dawnPatrol > 0 && overlay ? () => overlay.openFlights('Dawn departures', flightsByDepHours(model!.scoped, [5, 6])) : undefined} />
          <Tile value={p.commonHour === null ? '—' : hourLabel(p.commonHour)} label="Most common departure" accent={ACCENT} />
        </div>
        {/* 24h departure strip */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 46 }}>
          {p.hourCounts.map((c, h) => (
            <div key={h} title={`${hourLabel(h)}: ${c}`}
              style={{ flex: 1, height: `${Math.max((c / peak) * 100, c > 0 ? 5 : 0)}%`, background: GRAD, borderRadius: '2px 2px 0 0', opacity: 0.4 + 0.6 * (c / peak) }} />
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 9.5, color: 'var(--ink-2)' }}>
          <span>12am</span><span>6am</span><span>12pm</span><span>6pm</span><span>11pm</span>
        </div>
      </CardFrame>
    )
  },
}
