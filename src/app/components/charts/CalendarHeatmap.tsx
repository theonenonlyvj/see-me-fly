const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function CalendarHeatmap({
  matrix,
  accent,
  onCell,
}: {
  matrix: { year: number; months: number[] }[]
  accent: string
  onCell?: (year: number, monthIndex: number) => void
}) {
  // Find global max for opacity scaling
  const allCounts = matrix.flatMap((row) => row.months)
  const globalMax = Math.max(...allCounts, 1)

  return (
    <div style={{ fontFamily: 'var(--font)' }}>
      {/* Month header row */}
      <div style={{ display: 'grid', gridTemplateColumns: '40px repeat(12, 1fr)', gap: 3, marginBottom: 4 }}>
        <div />
        {MONTH_ABBR.map((m) => (
          <div key={m} style={{ fontSize: 9, color: 'var(--ink-2)', fontWeight: 600, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {m}
          </div>
        ))}
      </div>

      {/* Year rows */}
      {matrix.map((row) => (
        <div
          key={row.year}
          style={{ display: 'grid', gridTemplateColumns: '40px repeat(12, 1fr)', gap: 3, marginBottom: 3 }}
        >
          {/* Year label */}
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-2)', display: 'flex', alignItems: 'center', fontVariantNumeric: 'tabular-nums' }}>
            {row.year}
          </div>

          {/* 12 month cells */}
          {row.months.map((count, mi) => {
            const opacity = count === 0 ? 0.07 : 0.12 + 0.88 * (count / globalMax)
            return (
              <div
                key={mi}
                data-cell
                title={`${count} flights`}
                onClick={onCell && count > 0 ? () => onCell(row.year, mi) : undefined}
                style={{
                  height: 18,
                  borderRadius: 3,
                  backgroundColor: accent,
                  opacity,
                  cursor: onCell && count > 0 ? 'pointer' : 'default',
                }}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}
