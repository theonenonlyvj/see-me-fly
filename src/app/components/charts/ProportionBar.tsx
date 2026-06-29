export interface Segment { label: string; value: number; color: string; id?: string; iconUrl?: string }

/**
 * A single full-width 100%-stacked horizontal proportion bar with a legend.
 * Each segment's width = its share of the total. Clicking a segment fires onSegment.
 */
export default function ProportionBar({
  segments,
  onSegment,
  formatValue = (n: number) => n.toLocaleString('en-US'),
}: {
  segments: Segment[]
  onSegment?: (seg: Segment) => void
  formatValue?: (n: number) => string
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1
  const shown = segments.filter((s) => s.value > 0)

  return (
    <div style={{ fontFamily: 'var(--font)' }}>
      <div style={{ display: 'flex', height: 30, borderRadius: 8, overflow: 'hidden', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.06)' }}>
        {shown.map((s) => {
          const pct = (s.value / total) * 100
          return (
            <div
              key={s.label}
              title={`${s.label}: ${formatValue(s.value)} (${pct.toFixed(0)}%)`}
              onClick={onSegment ? () => onSegment(s) : undefined}
              style={{ width: `${pct}%`, background: s.color, cursor: onSegment ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: pct > 0 ? 2 : 0 }}
            >
              {pct >= 9 && <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.35)' }}>{pct.toFixed(0)}%</span>}
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 14 }}>
        {shown.map((s) => (
          <div
            key={s.label}
            onClick={onSegment ? () => onSegment(s) : undefined}
            style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: 9, cursor: onSegment ? 'pointer' : 'default' }}
          >
            {s.iconUrl
              ? <img src={s.iconUrl} alt="" style={{ height: 16, width: 'auto', maxWidth: 64, objectFit: 'contain', objectPosition: 'left center', flexShrink: 0 }} />
              : <span style={{ width: 11, height: 11, borderRadius: 3, background: s.color, flexShrink: 0 }} />}
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{s.label}</span>
            <span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
              {formatValue(s.value)} <span style={{ color: 'var(--ink-2)', fontWeight: 600 }}>· {((s.value / total) * 100).toFixed(0)}%</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
