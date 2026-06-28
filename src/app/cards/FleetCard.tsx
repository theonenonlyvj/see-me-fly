import CardFrame from '../components/CardFrame'
import { fleetStats } from '../../engine/stats'
import { flightsByTail } from '../lib/flight-filters'
import { fmtInt } from '../lib/format'
import type { CardContext, CardDef } from './registry'

const ACCENT = '#0e9f6e'
const GRAD = 'linear-gradient(90deg, #0e9f6e, #34d399)'
const SOFT = '#d9f7ec'

export const fleetCard: CardDef = {
  id: 'fleet',
  title: 'The fleet you’ve flown',
  group: 'creative',
  accent: ACCENT,
  icon: '✈️',
  render: ({ model, overlay }: CardContext) => {
    const f = fleetStats(model!.scoped)
    const oneTimerPct = f.distinctTails > 0 ? Math.round((f.oneTimers / f.distinctTails) * 100) : 0
    return (
      <CardFrame title="The fleet you’ve flown" eyebrow="Individual airframes" accent={ACCENT} accentGrad={GRAD} accentSoft={SOFT} icon="✈️">
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-2)', marginBottom: 4 }}>Distinct aircraft (by tail #)</div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 60, lineHeight: 0.9, background: GRAD, WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', color: 'transparent', fontVariantNumeric: 'tabular-nums' }}>{fmtInt(f.distinctTails)}</div>
        </div>
        {f.mostRepeated && (
          <div onClick={overlay ? () => overlay.openFlights(`Tail ${f.mostRepeated!.tail}`, flightsByTail(model!.scoped, f.mostRepeated!.tail)) : undefined}
            role={overlay ? 'button' : undefined}
            style={{ background: '#fff', border: '1px solid var(--hair-2)', borderRadius: 14, padding: '13px 15px', marginBottom: 10, cursor: overlay ? 'pointer' : 'default' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-2)' }}>Most-ridden airframe</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)' }}>{f.mostRepeated.tail} <span style={{ color: ACCENT }}>· {f.mostRepeated.count}×</span></div>
            <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>{f.mostRepeated.airline}</div>
          </div>
        )}
        <p style={{ fontSize: 12, color: 'var(--ink-2)' }}>
          <b style={{ color: 'var(--ink)' }}>{oneTimerPct}%</b> of your airframes you rode <b>only once</b> — {fmtInt(f.oneTimers)} one-and-done jets.
        </p>
      </CardFrame>
    )
  },
}
