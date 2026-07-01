import { polar, dayOfYear } from '../../lib/polar'
import type { EnrichedFlight } from '../../../engine'

/**
 * "13 Years Aloft" — the spiral year-clock. One thin radial tick per non-local flight,
 * placed on the concentric ring of its YEAR (inner = earliest, outer = latest) at an
 * ANGLE of its day-of-year (Jan 1 at 12 o'clock, clockwise). Tick WEIGHT ∝ log(distance);
 * tick COLOR = the home era active on that date, so relocations read as color bands
 * migrating outward through the years.
 *
 * Honesty: fixed-count ticks (one per flight), never area-filled — inner rings only look
 * dense because early years hold fewer, tighter marks packed onto a shorter circumference.
 * Weight is a log map (captioned by the card), so a transatlantic haul reads heavier than a
 * hop without letting distance dominate the geometry.
 */

const SIZE = 352
const CX = SIZE / 2
const CY = SIZE / 2
const R0 = 30 // inner radius (first year ring)
const R1 = 172 // outer radius (last year ring)

const MONTH_LETTERS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Angle (deg, 0=up/clockwise) for a YYYY-MM-DD date's position around the year clock. */
function angleOf(date: string): number {
  return (dayOfYear(date) / 365.25) * 360
}

/** Map a (possibly null) distance to a gentle stroke weight in px (~0.6 … 2.4). */
function weightOf(distanceMi: number | null): number {
  const MIN_MI = 90
  const MAX_MI = 8000
  if (distanceMi == null || distanceMi <= 0) return 0.6 // graceful min for unknown/local-zero
  const d = Math.max(MIN_MI, Math.min(MAX_MI, distanceMi))
  const t = Math.log(d / MIN_MI) / Math.log(MAX_MI / MIN_MI) // 0..1
  return 0.6 + t * 1.8 // 0.6 .. 2.4
}

/** Human "Mon DD, YYYY" from a YYYY-MM-DD string (no tz math). */
function fmtDay(date: string): string {
  const y = date.slice(0, 4)
  const mi = Number(date.slice(5, 7)) - 1
  const d = Number(date.slice(8, 10))
  return `${MONTH_NAMES[mi] ?? '?'} ${d}, ${y}`
}

export interface SpiralYearClockProps {
  flights: EnrichedFlight[]
  /** Home-era color for a given YYYY-MM-DD date. */
  colorFor: (date: string) => string
  /** The single busiest week to annotate (weekStart = Monday YYYY-MM-DD). Omit to skip. */
  busiest?: { weekStart: string; count: number } | null
}

export default function SpiralYearClock({ flights, colorFor, busiest }: SpiralYearClockProps) {
  // Non-local, dated flights only. Local hops (From==To) don't belong on a "where did you go" clock.
  const marks = flights.filter((f) => !f.isLocalFlight && f.date && f.date.length >= 10)

  const years = [...new Set(marks.map((f) => f.year))].filter((y) => Number.isFinite(y)).sort((a, b) => a - b)
  const yearCount = Math.max(1, years.length)
  const yearIndex = new Map(years.map((y, i) => [y, i]))
  const ringGap = (R1 - R0) / yearCount
  const ringR = (yi: number) => R0 + (yi + 0.5) * ringGap

  // Year labels: every ~4th (like the mockup) once there are many, else all of them.
  const labelStep = years.length > 8 ? 4 : 1

  // Annotation target: the busiest week's ring + angle (midpoint of the Mon-anchored week).
  let anno: { x: number; y: number; label: string } | null = null
  if (busiest && busiest.count > 0) {
    const y = Number(busiest.weekStart.slice(0, 4))
    const yi = yearIndex.get(y)
    if (yi != null) {
      // Aim at the middle of the week (weekStart + 3 days) so the leader lands on the cluster.
      const t0 = Date.parse(busiest.weekStart + 'T00:00:00Z')
      const mid = new Date(t0 + 3 * 86_400_000).toISOString().slice(0, 10)
      const a = angleOf(mid)
      const p = polar(CX, CY, ringR(yi), a)
      anno = { x: p.x, y: p.y, label: fmtDay(busiest.weekStart) }
    }
  }

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width="100%" height="100%" style={{ display: 'block', maxWidth: 420, margin: '0 auto' }} role="img" aria-label="Spiral year clock: one radial tick per flight, ring by year, angle by day of year">
      <defs>
        <radialGradient id="spiralWash" cx="50%" cy="50%" r="58%">
          <stop offset="0%" stopColor="#ff3d57" stopOpacity={0.1} />
          <stop offset="40%" stopColor="#ff2fa8" stopOpacity={0.08} />
          <stop offset="72%" stopColor="#6a3cff" stopOpacity={0.07} />
          <stop offset="100%" stopColor="#1aa9ff" stopOpacity={0.04} />
        </radialGradient>
      </defs>

      {/* low-opacity hero-gradient wash behind the ticks (the Pop glow) */}
      <circle cx={CX} cy={CY} r={R1 + 6} fill="url(#spiralWash)" />

      {/* month spokes (faint) + outer month letters */}
      {MONTH_LETTERS.map((letter, m) => {
        const ang = (m / 12) * 360
        const a = polar(CX, CY, R0 - 14, ang)
        const b = polar(CX, CY, R1 + 8, ang)
        const lp = polar(CX, CY, R1 + 16, ang + (0.5 / 12) * 360)
        return (
          <g key={`spoke${m}`}>
            <line
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="var(--hair)"
              strokeWidth={m === 0 ? 1.2 : 0.8}
              strokeOpacity={m === 0 ? 0.9 : 0.55}
            />
            <text x={lp.x} y={lp.y} fontSize={8.5} fill="#b3ac9e" textAnchor="middle" dominantBaseline="middle" fontFamily="var(--font)" fontWeight={700}>
              {letter}
            </text>
          </g>
        )
      })}

      {/* year ring guide circles (very faint) */}
      {years.map((_, yi) => (
        <circle key={`ring${yi}`} cx={CX} cy={CY} r={R0 + yi * ringGap} fill="none" stroke="#f0ebe1" strokeWidth={0.7} />
      ))}
      <circle cx={CX} cy={CY} r={R1} fill="none" stroke="#f0ebe1" strokeWidth={0.7} />

      {/* year labels riding the left (9 o'clock) spoke, on a small white pill */}
      {years.map((year, yi) => {
        if (yi % labelStep !== 0) return null
        const r = ringR(yi)
        const lbl = String(year)
        const w = lbl.length * 4.9 + 8
        const rightEdge = CX - r + w * 0.5
        return (
          <g key={`ylabel${yi}`}>
            <rect x={rightEdge - w} y={CY - 6.5} width={w} height={13} rx={3.5} fill="#ffffff" fillOpacity={0.9} />
            <text x={rightEdge - 4} y={CY} fontSize={8.5} fill="#8f8878" textAnchor="end" dominantBaseline="middle" fontFamily="var(--font)" fontWeight={700}>
              {lbl}
            </text>
          </g>
        )
      })}

      {/* the flight ticks — one radial mark per non-local flight */}
      {marks.map((f) => {
        const yi = yearIndex.get(f.year)
        if (yi == null) return null
        const baseR = ringR(yi)
        const ang = angleOf(f.date)
        const w = weightOf(f.distanceMi)
        const half = 0.55 + w * 0.9 // radial half-length grows gently with weight
        const a = polar(CX, CY, baseR - half, ang)
        const b = polar(CX, CY, baseR + half, ang)
        return (
          <line
            key={f.id}
            x1={a.x.toFixed(2)}
            y1={a.y.toFixed(2)}
            x2={b.x.toFixed(2)}
            y2={b.y.toFixed(2)}
            stroke={colorFor(f.date)}
            strokeWidth={w.toFixed(2)}
            strokeOpacity={0.8}
            strokeLinecap="round"
          />
        )
      })}

      {/* the ONE annotation: leader-line to the busiest week */}
      {anno && (
        <g>
          <circle cx={anno.x.toFixed(2)} cy={anno.y.toFixed(2)} r={3.4} fill="none" stroke="var(--ink)" strokeWidth={1.3} />
          <circle cx={anno.x.toFixed(2)} cy={anno.y.toFixed(2)} r={1.3} fill="var(--ink)" />
          <path
            d={`M${anno.x.toFixed(1)},${anno.y.toFixed(1)} L${(anno.x + 52).toFixed(1)},20 L${SIZE - 6},14`}
            fill="none"
            stroke="var(--ink)"
            strokeWidth={1}
            strokeOpacity={0.8}
            strokeLinejoin="round"
          />
          <rect x={SIZE - 168} y={2} width={162} height={26} rx={5} fill="#ffffff" fillOpacity={0.85} />
          <text x={SIZE - 8} y={13} fontSize={11.5} fill="var(--ink)" textAnchor="end" fontFamily="var(--font-display)" fontWeight={600}>
            {busiest!.count} flight{busiest!.count === 1 ? '' : 's'}
          </text>
          <text x={SIZE - 8} y={24} fontSize={8.5} fill="var(--ink-2)" textAnchor="end" fontFamily="var(--font)" fontWeight={500}>
            busiest week · {anno.label}
          </text>
        </g>
      )}
    </svg>
  )
}
