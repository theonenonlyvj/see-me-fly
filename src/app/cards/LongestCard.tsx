import { useState } from 'react'
import CardFrame from '../components/CardFrame'
import { fmtMiles, fmtDuration } from '../lib/format'
import { extremeFlights } from '../../engine/stats'
import type { CardContext, CardDef } from './registry'

const ACCENT      = '#ff3d57'
const ACCENT_GRAD = 'linear-gradient(90deg, #ff3d57, #ff7a14)'
const ACCENT_SOFT = '#ffe8ec'

type Metric = 'distance' | 'duration'

function LongestFlights(ctx: CardContext) {
  const [metric, setMetric] = useState<Metric>('distance')
  const flights = extremeFlights(ctx.model!.scoped, metric, 'long', 10)

  return (
    <CardFrame
      title="Longest flights"
      eyebrow="Epic hauls"
      accent={ACCENT}
      accentGrad={ACCENT_GRAD}
      accentSoft={ACCENT_SOFT}
      icon="🛬"
    >
      {/* metric toggle */}
      <div style={{ display: 'inline-flex', padding: 3, gap: 2, marginBottom: 18, background: ACCENT_SOFT, borderRadius: 12, border: `1px solid color-mix(in srgb, ${ACCENT} 24%, transparent)` }}>
        {(['distance', 'duration'] as Metric[]).map((m) => (
          <button key={m} onClick={() => setMetric(m)}
            style={{
              fontFamily: 'var(--font)', fontSize: 12, fontWeight: 800,
              border: 'none', cursor: 'pointer', padding: '6px 13px', borderRadius: 9,
              color: metric === m ? '#fff' : ACCENT,
              background: metric === m ? `linear-gradient(90deg, ${ACCENT}, #ff7a14)` : 'transparent',
              boxShadow: metric === m ? `0 5px 12px -4px color-mix(in srgb, ${ACCENT} 78%, transparent)` : 'none',
            }}>
            {m}
          </button>
        ))}
      </div>

      {flights.length === 0 ? (
        <p style={{ color: 'var(--ink-2)' }}>No data for this view.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {flights.map((f) => {
            const val = metric === 'distance' ? fmtMiles(f.distanceMi ?? 0) : fmtDuration(f.durationMin)
            return (
              <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 13, color: 'var(--ink)' }}>
                <span style={{ fontWeight: 600 }}>
                  {f.date} · {f.fromCode}→{f.toCode}
                </span>
                <span style={{ fontWeight: 800, color: ACCENT, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', marginLeft: 12 }}>
                  {val}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </CardFrame>
  )
}

export const longestCard: CardDef = {
  id: 'longest',
  title: 'Longest flights',
  group: 'creative',
  accent: ACCENT,
  icon: '🛬',
  render: (ctx: CardContext) => <LongestFlights {...ctx} />,
}
