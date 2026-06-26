import { useState } from 'react'

export interface BarRow { label: string; value: number; sub?: string }

export default function BarList({ rows, max = 10, formatValue = (n: number) => n.toLocaleString('en-US') }: {
  rows: BarRow[]; max?: number; formatValue?: (n: number) => string
}) {
  const [expanded, setExpanded] = useState(false)
  if (rows.length === 0) return <p style={{ color: 'var(--text-dim)' }}>No data for this view.</p>
  const peak = Math.max(...rows.map((r) => r.value), 1)
  const shown = expanded ? rows : rows.slice(0, max)
  return (
    <div>
      <div style={{ display: 'grid', gap: 6 }}>
        {shown.map((r) => (
          <div key={r.label} style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 8 }}>
            <div style={{ position: 'relative', background: 'var(--bar-track)', borderRadius: 6, height: 24, overflow: 'hidden' }}>
              <div style={{ position: 'absolute', inset: 0, width: `${(r.value / peak) * 100}%`, background: 'var(--accent)', opacity: 0.35 }} />
              <span style={{ position: 'relative', padding: '0 8px', lineHeight: '24px', whiteSpace: 'nowrap' }}>{r.label}{r.sub && <span style={{ color: 'var(--text-dim)' }}> · {r.sub}</span>}</span>
            </div>
            <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text)' }}>{formatValue(r.value)}</span>
          </div>
        ))}
      </div>
      {rows.length > max && (
        <button onClick={() => setExpanded((v) => !v)} style={{ marginTop: 10, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-dim)', borderRadius: 'var(--radius-sm)', padding: '4px 10px' }}>
          {expanded ? 'Show less' : `Show more (${rows.length - max})`}
        </button>
      )}
    </div>
  )
}
