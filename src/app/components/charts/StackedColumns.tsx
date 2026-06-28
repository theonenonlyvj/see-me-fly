export interface ColSeries { name: string; color: string; counts: number[] }

/**
 * Per-year vertical column chart. `years` is the x-axis (pass a CONTINUOUS range so gap years
 * read as honest low/zero columns). `series` stack within each column. Single-series = a plain
 * career-arc bar chart; multi-series = stacked eras. Clicking a column with data fires onYear.
 */
export default function StackedColumns({
  years,
  series,
  accent,
  height = 150,
  onYear,
  highlightYear,
}: {
  years: number[]
  series: ColSeries[]
  accent: string
  height?: number
  onYear?: (year: number) => void
  highlightYear?: number
}) {
  if (years.length === 0) return null // defensive: nothing to plot
  const totals = years.map((_, i) => series.reduce((s, ser) => s + (ser.counts[i] || 0), 0))
  const peak = Math.max(...totals, 1)
  const peakIdx = totals.indexOf(Math.max(...totals))
  const labelStep = years.length > 16 ? 5 : years.length > 8 ? 2 : 1
  const stacked = series.length > 1

  return (
    <div style={{ fontFamily: 'var(--font)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: years.length > 24 ? 1 : 2, height }}>
        {years.map((y, i) => {
          const total = totals[i]
          const colH = (total / peak) * 100
          const clickable = onYear && total > 0
          return (
            <div
              key={y}
              data-col
              title={`${y}: ${total}`}
              onClick={clickable ? () => onYear!(y) : undefined}
              style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', cursor: clickable ? 'pointer' : 'default', opacity: highlightYear && highlightYear !== y ? 0.4 : 1 }}
            >
              <div style={{ height: `${Math.max(colH, total > 0 ? 3 : 0)}%`, display: 'flex', flexDirection: 'column-reverse', borderRadius: '3px 3px 0 0', overflow: 'hidden' }}>
                {series.map((ser, si) => {
                  const v = ser.counts[i] || 0
                  if (v === 0) return null
                  return <div key={ser.name} style={{ flex: v, background: ser.color, opacity: stacked ? 1 : (0.45 + 0.55 * (total / peak)), boxShadow: si === 0 ? `0 0 10px -3px ${accent}` : undefined }} />
                })}
              </div>
            </div>
          )
        })}
      </div>
      {/* year axis */}
      <div style={{ display: 'flex', gap: years.length > 24 ? 1 : 2, marginTop: 4 }}>
        {years.map((y, i) => (
          <div key={y} style={{ flex: 1, textAlign: 'center', fontSize: 9, color: 'var(--ink-2)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            {i % labelStep === 0 ? `'${String(y).slice(2)}` : ''}
          </div>
        ))}
      </div>
      {stacked ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginTop: 12 }}>
          {series.map((ser) => (
            <span key={ser.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, color: 'var(--ink-2)' }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: ser.color, flexShrink: 0 }} />{ser.name}
            </span>
          ))}
        </div>
      ) : (
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--ink-2)', fontWeight: 600 }}>
          Peak: <span style={{ color: accent, fontWeight: 800 }}>{years[peakIdx]} ({peak})</span>
        </div>
      )}
    </div>
  )
}
