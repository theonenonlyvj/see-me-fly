import { useState } from 'react'

export interface BarRow { label: string; value: number; sub?: string }

export default function BarList({ rows, max = 10, formatValue = (n: number) => n.toLocaleString('en-US'), accent, accentGrad, accentSoft }: {
  rows: BarRow[]
  max?: number
  formatValue?: (n: number) => string
  accent?: string
  accentGrad?: string
  accentSoft?: string
}) {
  const [expanded, setExpanded] = useState(false)
  if (rows.length === 0) return <p style={{ color: 'var(--ink-2)' }}>No data for this view.</p>
  const peak = Math.max(...rows.map((r) => r.value), 1)
  const shown = expanded ? rows : rows.slice(0, max)

  const acc   = accent    ?? 'var(--coral)'
  const grad  = accentGrad ?? `linear-gradient(90deg, ${acc}, ${acc})`
  const soft  = accentSoft ?? 'var(--hair-2)'

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
        {shown.map((r) => (
          <div key={r.label} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '7px 14px', alignItems: 'baseline' }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              {r.label}
              {r.sub && <span style={{ color: 'var(--ink-2)', fontWeight: 500, fontSize: 12 }}>{r.sub}</span>}
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums', textAlign: 'right', whiteSpace: 'nowrap' }}>
              {formatValue(r.value)}
            </div>
            {/* chunky gradient bar track */}
            <div style={{ gridColumn: '1 / -1', height: 13, borderRadius: 999, background: soft, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                borderRadius: 999,
                width: `${(r.value / peak) * 100}%`,
                background: grad,
                boxShadow: `0 0 16px -2px color-mix(in srgb, ${acc} 80%, transparent), 0 0 4px 0 color-mix(in srgb, ${acc} 60%, transparent) inset`,
              }} />
            </div>
          </div>
        ))}
      </div>
      {rows.length > max && (
        <button
          onClick={() => setExpanded((v) => !v)}
          style={{
            marginTop: 18,
            fontSize: 12.5, fontWeight: 800,
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: grad,
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            color: 'transparent',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
          }}
        >
          {expanded ? 'Show less ▴' : `Show more (${rows.length - max}) ▾`}
        </button>
      )}
    </div>
  )
}
