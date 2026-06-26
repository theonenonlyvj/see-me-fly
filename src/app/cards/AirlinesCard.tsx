import CardFrame from '../components/CardFrame'
import { monogram } from '../lib/format'
import type { CardContext, CardDef } from './registry'
import { useState } from 'react'

const ACCENT      = '#1aa9ff'
const ACCENT_GRAD = 'linear-gradient(90deg, #1aa9ff, #5ad0ff)'
const ACCENT_SOFT = '#e0f2ff'

function AirlinesList({ model }: CardContext) {
  const [expanded, setExpanded] = useState(false)
  const rows = model!.byAirline
  const max = 10
  const shown = expanded ? rows : rows.slice(0, max)
  const peak = Math.max(...rows.map((r) => r.count), 1)

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 17 }}>
        {shown.map((r) => {
          const { initials, color } = monogram(r.name)
          const pct = (r.count / peak) * 100
          return (
            <div key={r.name} style={{ display: 'grid', gridTemplateColumns: '40px 1fr auto', gap: 13, alignItems: 'center' }}>
              {/* monogram circle */}
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                display: 'grid', placeItems: 'center',
                fontSize: 12.5, fontWeight: 900, letterSpacing: '0.02em',
                color: '#fff',
                background: color,
                boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.28), 0 6px 14px -5px rgba(0,0,0,0.42)',
              }}>{initials}</div>
              {/* name + bar */}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>{r.name}</div>
                <div style={{ height: 10, borderRadius: 999, background: ACCENT_SOFT, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 999,
                    width: `${pct}%`,
                    background: ACCENT_GRAD,
                    boxShadow: `0 0 14px -2px color-mix(in srgb, ${ACCENT} 75%, transparent)`,
                  }} />
                </div>
              </div>
              {/* count */}
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{r.count}</div>
            </div>
          )
        })}
      </div>
      {rows.length > max && (
        <button
          onClick={() => setExpanded((v) => !v)}
          style={{
            marginTop: 18, fontSize: 12.5, fontWeight: 800,
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: ACCENT_GRAD,
            WebkitBackgroundClip: 'text', backgroundClip: 'text',
            WebkitTextFillColor: 'transparent', color: 'transparent',
            border: 'none', padding: 0, cursor: 'pointer',
          }}
        >{expanded ? 'Show less ▴' : `Show more (${rows.length - max}) ▾`}</button>
      )}
      <div style={{ marginTop: 18, fontSize: 11.5, color: 'var(--ink-2)', fontStyle: 'italic' }}>
        Monograms are placeholders — real airline logos land here later.
      </div>
    </div>
  )
}

export const airlinesCard: CardDef = {
  id: 'airlines',
  title: 'Airlines',
  group: 'core',
  accent: ACCENT,
  icon: '🛩️',
  render: (ctx: CardContext) => (
    <CardFrame title="Airlines" eyebrow="Who flew you" accent={ACCENT} accentGrad={ACCENT_GRAD} accentSoft={ACCENT_SOFT} icon="🛩️">
      <AirlinesList {...ctx} />
    </CardFrame>
  ),
}
