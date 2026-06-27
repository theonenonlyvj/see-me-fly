import { useState } from 'react'
import CardFrame from '../components/CardFrame'
import { WorldMap } from '../components/charts/WorldMap'
import type { CardContext, CardDef } from './registry'

const ACCENT      = 'var(--accent-4)'
const ACCENT_GRAD = 'linear-gradient(90deg, var(--accent-4), color-mix(in srgb, var(--accent-4) 60%, white))'
const ACCENT_SOFT = 'color-mix(in srgb, var(--accent-4) 10%, white)'

type Mode = 'routes' | 'heat'

function MapView(ctx: CardContext) {
  const [mode, setMode] = useState<Mode>('routes')
  return (
    <CardFrame title="Your map" eyebrow="Where you've flown" accent={ACCENT} accentGrad={ACCENT_GRAD} accentSoft={ACCENT_SOFT} icon="🗺️" fullWidth>
      <div style={{ display: 'inline-flex', padding: 3, gap: 2, marginBottom: 14, background: ACCENT_SOFT, borderRadius: 12, border: `1px solid color-mix(in srgb, ${ACCENT} 24%, transparent)` }}>
        {([['routes', 'Routes'], ['heat', 'Heatmap']] as [Mode, string][]).map(([m, label]) => (
          <button key={m} onClick={() => setMode(m)}
            style={{
              fontFamily: 'var(--font)', fontSize: 12, fontWeight: 800,
              border: 'none', cursor: 'pointer', padding: '6px 13px', borderRadius: 9,
              color: mode === m ? '#fff' : 'var(--ink)',
              background: mode === m ? ACCENT : 'transparent',
            }}>
            {label}
          </button>
        ))}
      </div>
      <WorldMap flights={ctx.model!.scoped} accent="var(--accent-4)" mode={mode} groupAirports={ctx.settings.groupAirports} />
      <p style={{ marginTop: 8, fontSize: 11.5, color: 'var(--ink-2)', fontStyle: 'italic' }}>
        {mode === 'routes' ? 'Great-circle routes; thicker = flown more often.' : 'Bubble size & color = how often you visit each airport.'}
      </p>
    </CardFrame>
  )
}

export const mapCard: CardDef = {
  id: 'map',
  title: 'Your map',
  group: 'creative',
  accent: ACCENT,
  icon: '🗺️',
  render: (ctx: CardContext) => <MapView {...ctx} />,
}
