import { useEffect, useState } from 'react'
import { useOverlay } from '../Overlay'

export interface BarRow {
  label: string
  value: number
  sub?: string
  /** optional small leading icon (flag/logo data-URI) */
  iconUrl?: string
  /** render the icon as a wider wordmark (airline logos) instead of a small square chip (flags) */
  iconWide?: boolean
  /** Stable identifier (country code, route key, …) passed back to onRowClick. */
  id?: string
  /** Optional nested breakdown; when present the row's `sub` text becomes an expand toggle. */
  subRows?: { label: string; value: number }[]
}

const STEP = 10

function Row({ r, peak, acc, grad, soft, formatValue, onClick }: {
  r: BarRow
  peak: number
  acc: string
  grad: string
  soft: string
  formatValue: (n: number) => string
  onClick?: () => void
}) {
  const [open, setOpen] = useState(false)
  const hasSub = !!(r.subRows && r.subRows.length > 0)

  return (
    <div>
      <div
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '7px 14px', alignItems: 'baseline', cursor: onClick ? 'pointer' : undefined }}
      >
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          {r.iconUrl && <img src={r.iconUrl} alt="" style={r.iconWide
            ? { height: 16, width: 'auto', maxWidth: 78, objectFit: 'contain', objectPosition: 'left center', flexShrink: 0 }
            : { height: 14, width: 'auto', maxWidth: 22, objectFit: 'contain', borderRadius: 2, flexShrink: 0, boxShadow: '0 0 0 0.5px rgba(0,0,0,0.15)' }} />}
          {r.label}
          {r.sub && (hasSub ? (
            <button
              onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
              aria-expanded={open}
              style={{ color: acc, fontWeight: 700, fontSize: 12, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
            >
              {r.sub} {open ? '▴' : '▾'}
            </button>
          ) : (
            <span style={{ color: 'var(--ink-2)', fontWeight: 500, fontSize: 12 }}>{r.sub}</span>
          ))}
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

      {hasSub && open && (
        <div style={{ margin: '8px 0 2px 14px', paddingLeft: 12, borderLeft: `2px solid ${soft}`, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {r.subRows!.map((s) => (
            <div key={`${r.label}:${s.label}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12.5, color: 'var(--ink-2)' }}>
              <span style={{ fontWeight: 600 }}>{s.label}</span>
              <span style={{ fontWeight: 700, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{formatValue(s.value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MoreButton({ label, grad, onClick }: { label: string; grad: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: 12.5, fontWeight: 800,
        display: 'inline-flex', alignItems: 'center', gap: 6,
        background: grad,
        WebkitBackgroundClip: 'text', backgroundClip: 'text',
        WebkitTextFillColor: 'transparent', color: 'transparent',
        border: 'none', padding: 0, cursor: 'pointer',
      }}
    >{label}</button>
  )
}

export default function BarList({ rows, max = 10, formatValue = (n: number) => n.toLocaleString('en-US'), accent, accentGrad, accentSoft, onRowClick, seeAllTitle }: {
  rows: BarRow[]
  max?: number
  formatValue?: (n: number) => string
  accent?: string
  accentGrad?: string
  accentSoft?: string
  onRowClick?: (row: BarRow) => void
  /** When set, a row overflow shows a single "See all (N) →" that opens the full list in a popup. */
  seeAllTitle?: string
}) {
  const [visible, setVisible] = useState(max)
  const overlay = useOverlay()
  // Reset expansion when the underlying data set changes (e.g. switching year scope),
  // so a stale "Show less" can't linger after the row count shrinks below it.
  useEffect(() => { setVisible(max) }, [rows.length, max])
  if (rows.length === 0) return <p style={{ color: 'var(--ink-2)' }}>No data for this view.</p>

  const peak = Math.max(...rows.map((r) => r.value), 1)
  const shown = rows.slice(0, visible)
  const remaining = rows.length - visible

  const acc  = accent     ?? 'var(--coral)'
  const grad = accentGrad ?? `linear-gradient(90deg, ${acc}, ${acc})`
  const soft = accentSoft ?? 'var(--hair-2)'

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
        {shown.map((r) => (
          <Row key={r.label} r={r} peak={peak} acc={acc} grad={grad} soft={soft} formatValue={formatValue}
            onClick={onRowClick ? () => onRowClick(r) : undefined} />
        ))}
      </div>
      {seeAllTitle ? (
        rows.length > max && (
          <div style={{ marginTop: 18 }}>
            <MoreButton
              label={`See all (${rows.length}) →`}
              grad={grad}
              onClick={() => overlay.openList(
                seeAllTitle,
                <BarList rows={rows} max={rows.length} formatValue={formatValue} accent={accent} accentGrad={accentGrad} accentSoft={accentSoft} onRowClick={onRowClick} />,
              )}
            />
          </div>
        )
      ) : (remaining > 0 || visible > max) && (
        <div style={{ marginTop: 18, display: 'flex', gap: 18, flexWrap: 'wrap' }}>
          {remaining > 0 && (
            <MoreButton label={`Show ${Math.min(STEP, remaining)} more ▾`} grad={grad} onClick={() => setVisible((v) => Math.min(v + STEP, rows.length))} />
          )}
          {remaining > STEP && (
            <MoreButton label={`Show all (${rows.length}) ▾`} grad={grad} onClick={() => setVisible(rows.length)} />
          )}
          {visible > max && (
            <MoreButton label="Show less ▴" grad={grad} onClick={() => setVisible(max)} />
          )}
        </div>
      )}
    </div>
  )
}
