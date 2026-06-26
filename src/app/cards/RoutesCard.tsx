import { useState } from 'react'
import CardFrame from '../components/CardFrame'
import { fmtInt, fmtMiles } from '../lib/format'
import type { CardContext, CardDef } from './registry'

const ACCENT      = '#6a3cff'
const ACCENT_GRAD = 'linear-gradient(90deg, #6a3cff, #9a6bff)'
const ACCENT_SOFT = '#ebe4ff'

/** Split a route key like "A ↔ B" or "A → B" into two endpoints. */
function splitRoute(key: string): [string, string] | null {
  const sep = key.includes('↔') ? '↔' : key.includes('→') ? '→' : null
  if (!sep) return null
  const parts = key.split(sep).map((s) => s.trim())
  if (parts.length !== 2) return null
  return [parts[0], parts[1]]
}

/** Return the route label with Dallas leading if present; original key otherwise. */
function routeLabel(key: string): { left: string; right: string; sep: string } | null {
  const m = splitRoute(key)
  if (!m) return null
  const [a, b] = m
  const sep = key.includes('↔') ? '↔' : '→'
  const aDallas = a.toLowerCase().includes('dallas')
  const bDallas = b.toLowerCase().includes('dallas')
  if (bDallas && !aDallas) return { left: b, right: a, sep }
  return { left: a, right: b, sep }
}

function Routes({ model }: CardContext) {
  const [metric, setMetric] = useState<'count' | 'miles'>('count')
  const peak = Math.max(...model!.byRoute.map((r) => metric === 'count' ? r.count : r.miles), 1)

  const sorted = [...model!.byRoute].sort((a, b) => metric === 'count' ? b.count - a.count : b.miles - a.miles)

  const [expanded, setExpanded] = useState(false)
  const max = 10
  const shown = expanded ? sorted : sorted.slice(0, max)

  const toggle = (
    <div style={{ display: 'inline-flex', padding: 3, gap: 2, marginBottom: 18, background: ACCENT_SOFT, borderRadius: 12, border: `1px solid color-mix(in srgb, ${ACCENT} 24%, transparent)` }}>
      {(['count', 'miles'] as const).map((m) => (
        <button key={m} onClick={() => setMetric(m)}
          style={{
            fontFamily: 'var(--font)', fontSize: 12, fontWeight: 800,
            border: 'none', cursor: 'pointer', padding: '6px 13px', borderRadius: 9,
            color: metric === m ? '#fff' : ACCENT,
            background: metric === m ? `linear-gradient(90deg, ${ACCENT}, #9a6bff)` : 'transparent',
            boxShadow: metric === m ? `0 5px 12px -4px color-mix(in srgb, ${ACCENT} 78%, transparent)` : 'none',
          }}>
          {m === 'count' ? '# flights' : 'miles'}
        </button>
      ))}
    </div>
  )

  return (
    <CardFrame title="Top routes" eyebrow="Your corridors" accent={ACCENT} accentGrad={ACCENT_GRAD} accentSoft={ACCENT_SOFT} icon="🛫">
      {toggle}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
        {shown.map((r) => {
          const parts = routeLabel(r.key)
          const value = metric === 'count' ? r.count : Math.round(r.miles)
          const pct = (value / peak) * 100
          // parenthetical: in #flights view show avg miles; in miles view show count
          const avgMi = r.count > 0 ? Math.round(r.miles / r.count) : 0
          const sub = metric === 'count'
            ? `avg ${fmtInt(avgMi)} mi`
            : `${r.count} flights`

          return (
            <div key={r.key} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '6px 14px', alignItems: 'baseline' }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 7 }}>
                {parts ? (
                  <>
                    <span style={{ color: ACCENT, fontWeight: 800 }}>{parts.left}</span>
                    <span style={{ color: ACCENT, fontWeight: 800 }}>{parts.sep}</span>
                    {parts.right}
                  </>
                ) : r.key}
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums', textAlign: 'right', whiteSpace: 'nowrap' }}>
                {metric === 'count' ? fmtInt(value) : fmtMiles(value)}{' '}
                <small style={{ fontWeight: 500, color: 'var(--ink-2)', fontSize: 12 }}>· {sub}</small>
              </div>
              {/* bar track */}
              <div style={{ gridColumn: '1 / -1', height: 13, borderRadius: 999, background: ACCENT_SOFT, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 999, width: `${pct}%`,
                  background: ACCENT_GRAD,
                  boxShadow: `0 0 16px -2px color-mix(in srgb, ${ACCENT} 80%, transparent)`,
                }} />
              </div>
            </div>
          )
        })}
      </div>
      {sorted.length > max && (
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
        >{expanded ? 'Show less ▴' : `Show more (${sorted.length - max}) ▾`}</button>
      )}
    </CardFrame>
  )
}

export const routesCard: CardDef = {
  id: 'routes',
  title: 'Routes',
  group: 'core',
  accent: ACCENT,
  icon: '🛫',
  render: (ctx: CardContext) => <Routes {...ctx} />,
}
