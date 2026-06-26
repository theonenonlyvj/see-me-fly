export default function HourHistogram({
  counts,
  accent,
  label,
}: {
  counts: number[]
  accent: string
  label?: string
}) {
  const peak = Math.max(...counts, 1)
  const peakIndex = counts.indexOf(Math.max(...counts))
  const peakLabel = peakIndex === 0 ? '12am' : peakIndex < 12 ? `${peakIndex}am` : peakIndex === 12 ? '12pm' : `${peakIndex - 12}pm`

  // Tick marks at hours 0, 6, 12, 18
  const ticks = [0, 6, 12, 18]
  const tickLabels: Record<number, string> = { 0: '12am', 6: '6am', 12: '12pm', 18: '6pm' }

  return (
    <div style={{ fontFamily: 'var(--font)' }}>
      {label && (
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {label}
        </div>
      )}

      {/* Bar area */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 64 }}>
        {counts.map((count, i) => {
          const heightPct = (count / peak) * 100
          return (
            <div
              key={i}
              data-bar
              title={`${i < 12 ? (i === 0 ? '12am' : `${i}am`) : i === 12 ? '12pm' : `${i - 12}pm`}: ${count}`}
              style={{
                flex: 1,
                height: `${Math.max(heightPct, 4)}%`,
                borderRadius: '3px 3px 0 0',
                background: `linear-gradient(180deg, color-mix(in srgb, ${accent} 90%, white), ${accent})`,
                opacity: 0.35 + 0.65 * (count / peak),
                transition: 'opacity 0.2s',
              }}
            />
          )
        })}
      </div>

      {/* X-axis ticks */}
      <div style={{ display: 'flex', position: 'relative', marginTop: 4 }}>
        {ticks.map((hour) => (
          <div
            key={hour}
            style={{
              position: 'absolute',
              left: `${(hour / 23) * 100}%`,
              fontSize: 10,
              color: 'var(--ink-2)',
              fontVariantNumeric: 'tabular-nums',
              transform: 'translateX(-50%)',
              whiteSpace: 'nowrap',
            }}
          >
            {tickLabels[hour]}
          </div>
        ))}
      </div>

      {/* Peak hour caption */}
      <div style={{ marginTop: 20, fontSize: 12, color: 'var(--ink-2)', fontWeight: 600 }}>
        Busiest:{' '}
        <span style={{ color: accent, fontWeight: 800 }}>{peakLabel}</span>
      </div>
    </div>
  )
}
