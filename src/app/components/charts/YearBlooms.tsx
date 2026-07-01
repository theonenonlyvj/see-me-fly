import { polar } from '../../lib/polar'

/**
 * A grid of small radial "blooms" — one per year. Each bloom is a 12-spoke
 * month clock (Jan at 12 o'clock, clockwise). Spoke LENGTH encodes that
 * month's flight count, scaled by a SINGLE shared radius scale across all
 * years, so heavy years visibly out-bloom light ones.
 *
 * Honesty: length-only bars (thin strokes), never filled wedges — so no
 * circumference/area implies density the data lacks.
 */

const SIZE = 84 // per-bloom SVG viewBox (square)
const CX = SIZE / 2
const CY = SIZE / 2
const R_INNER = 5.5 // hub radius (center dead-zone)
const R_OUTER = 35 // max spoke reach at the global max
const BAR_W = 2.6

function Bloom({ months, globalMax, accent }: { months: number[]; globalMax: number; accent: string }) {
  const span = R_OUTER - R_INNER

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width="100%" height="100%" style={{ maxHeight: 150, display: 'block' }} aria-hidden>
      {/* faint outer guide ring at the shared max scale */}
      <circle cx={CX} cy={CY} r={R_OUTER} fill="none" stroke="var(--hair)" strokeWidth={1} />
      {/* hub */}
      <circle cx={CX} cy={CY} r={R_INNER - 1.5} fill="var(--hair-2)" stroke="var(--hair)" strokeWidth={0.8} />

      {/* faint full-length guide spokes (12 of them) behind the bars */}
      {months.map((_, i) => {
        const ang = (i / 12) * 360 // Jan (i=0) at 12 o'clock, clockwise
        const a = polar(CX, CY, R_INNER, ang)
        const b = polar(CX, CY, R_OUTER, ang)
        return (
          <line
            key={`g${i}`}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke="var(--hair)"
            strokeWidth={0.7}
            opacity={0.55}
          />
        )
      })}

      {/* the month bars — length only, in the accent color */}
      {months.map((v, i) => {
        if (v <= 0) return null
        const len = (v / globalMax) * span
        const ang = (i / 12) * 360
        const a = polar(CX, CY, R_INNER, ang)
        const b = polar(CX, CY, R_INNER + len, ang)
        return (
          <line
            key={`b${i}`}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke={accent}
            strokeWidth={BAR_W}
            strokeLinecap="round"
          >
            <title>{`Month ${i + 1}: ${v} flight${v === 1 ? '' : 's'}`}</title>
          </line>
        )
      })}

      {/* center dot */}
      <circle cx={CX} cy={CY} r={1.4} fill={accent} />
    </svg>
  )
}

export default function YearBlooms({
  data,
  accent = 'var(--coral)',
}: {
  data: { year: number; months: number[] }[]
  accent?: string
}) {
  // Single shared radius scale across ALL years — the whole point.
  const globalMax = Math.max(1, ...data.flatMap((d) => d.months))

  return (
    <div style={{ fontFamily: 'var(--font)' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: '10px 8px',
        }}
      >
        {data.map((d) => (
          <div key={d.year} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Bloom months={d.months} globalMax={globalMax} accent={accent} />
            <div
              style={{
                marginTop: 2,
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--ink-2)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {d.year}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
