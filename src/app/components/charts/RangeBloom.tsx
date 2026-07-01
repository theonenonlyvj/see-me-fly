import { polar } from '../../lib/polar'
import type { Continent } from '../../../engine'
import type { RangeBloomDestination } from '../../../engine/stats'

/**
 * "Home-Anchored Range Bloom" — a polar radar-sky. HOME sits at the center (a soft
 * hero-gradient glow); every distinct destination is a dot placed at its true compass
 * bearing (0°=N, clockwise) and its great-circle distance from the era-correct home.
 *
 * Honest encoding:
 *  - RADIAL scale is sqrt(distance) (radius ∝ √mi), so the dense near-home cluster stays
 *    legible instead of collapsing onto the center — the rings are LABELED with their real
 *    mileage so the compression is never misread as linear distance.
 *  - Dot AREA ∝ visits (radius ∝ √visits), never radius = count — a 40-visit dot has 40× the
 *    ink of a 1-visit dot, not 40× the width.
 *  - Hue = continent (a fixed Pop map, consistent with the rest of the deck).
 *  - Exactly one annotation: a leader-line to the single farthest destination.
 */

const SIZE = 360
const CX = SIZE / 2
const CY = SIZE / 2
const R_MAX = 140 // px radius at the farthest destination (the outer data ring)

/** Continent → Pop hue. AS + OC share magenta (few marks, one "the East / Pacific" family). */
export const CONTINENT_COLORS: Record<Continent, string> = {
  NA: 'var(--coral)',      // #ff3d57
  EU: 'var(--indigo)',     // #6a3cff
  AS: 'var(--magenta)',    // #ff2fa8
  OC: 'var(--magenta)',    // #ff2fa8 (grouped with Asia in the legend)
  SA: 'var(--lime)',       // #12c08a
  AF: 'var(--tangerine)',  // #ff7a14
  AN: 'var(--sky)',        // #1aa9ff
}
const UNKNOWN_COLOR = '#c8ccd6'

function colorFor(c: Continent | null): string {
  return c ? CONTINENT_COLORS[c] : UNKNOWN_COLOR
}

/** The continent legend, in a fixed order; AS/OC collapse to one "Asia / Oceania" row. */
export const CONTINENT_LEGEND: { label: string; color: string; match: Continent[] }[] = [
  { label: 'N. America', color: CONTINENT_COLORS.NA, match: ['NA'] },
  { label: 'Europe', color: CONTINENT_COLORS.EU, match: ['EU'] },
  { label: 'Asia / Oceania', color: CONTINENT_COLORS.AS, match: ['AS', 'OC'] },
  { label: 'S. America', color: CONTINENT_COLORS.SA, match: ['SA'] },
  { label: 'Africa', color: CONTINENT_COLORS.AF, match: ['AF'] },
  { label: 'Antarctica', color: CONTINENT_COLORS.AN, match: ['AN'] },
]

/** "1,380" style thousands separator. */
const fmtMi = (n: number) => Math.round(n).toLocaleString('en-US')

/** Compact ring label: 500 / 1k / 3k / 8.5k. */
function ringLabel(mi: number): string {
  if (mi < 1000) return String(Math.round(mi / 50) * 50)
  const k = mi / 1000
  return (k >= 10 ? Math.round(k) : Math.round(k * 10) / 10) + 'k'
}

/**
 * Choose ~4 labeled ring values that span the data, snapped to friendly magnitudes and
 * always ending at the true max (so the outer ring is honest, not rounded past the data).
 */
function chooseRings(maxMi: number): number[] {
  const candidates = [250, 500, 1000, 2000, 3000, 4000, 6000, 8000, 10000]
  // Drop candidates within ~12% of the max so an inner ring never crowds the labeled outer rim.
  const inner = candidates.filter((c) => c < maxMi * 0.88)
  // Keep up to 3 nicely-spread inner rings + the exact max.
  let picked: number[] = inner
  if (inner.length > 3) {
    // Even-ish sample across the inner set.
    const step = (inner.length - 1) / 3
    picked = [0, 1, 2, 3].map((i) => inner[Math.round(i * step)])
    picked = [...new Set(picked)]
  }
  return [...picked, maxMi]
}

export interface RangeBloomProps {
  destinations: RangeBloomDestination[]
  /** The single farthest destination to annotate (usually destinations[0]). Omit to skip. */
  farthest?: RangeBloomDestination | null
  /** Home label for the center caption, e.g. "DFW" or "Dallas". */
  homeLabel?: string
  /** When set, dots are clickable and call this with the picked destination. */
  onPick?: (d: RangeBloomDestination) => void
}

export default function RangeBloom({ destinations, farthest, homeLabel, onPick }: RangeBloomProps) {
  const maxMi = Math.max(1, ...destinations.map((d) => d.distanceMi))
  const maxVisits = Math.max(1, ...destinations.map((d) => d.visits))

  // sqrt radial scale: radius ∝ √(mi/maxMi). Near-home stays readable; rings label the truth.
  const ringRadius = (mi: number) => R_MAX * Math.sqrt(Math.max(0, mi) / maxMi)

  // Dot radius ∝ √visits so AREA (πr²) is proportional to the count. Clamp to a legible band.
  const R_DOT_MIN = 2.6
  const R_DOT_MAX = 13
  const dotRadius = (visits: number) =>
    R_DOT_MIN + (R_DOT_MAX - R_DOT_MIN) * Math.sqrt(visits / maxVisits)

  const rings = chooseRings(maxMi)

  // Draw far/large dots first so near/small ones land on top and nothing is fully hidden.
  const drawn = [...destinations].sort((a, b) => b.distanceMi - a.distanceMi || b.visits - a.visits)

  // Annotation geometry: point at the farthest dot, leader out to a label pinned to a corner.
  let anno: { px: number; py: number; labelX: number; label1: string; label2: string } | null = null
  if (farthest) {
    const p = polar(CX, CY, ringRadius(farthest.distanceMi), farthest.bearing)
    // Send the leader toward whichever side has more room (mirror horizontally around center).
    const leftSide = p.x >= CX
    const labelX = leftSide ? 16 : SIZE - 16
    anno = {
      px: p.x,
      py: p.y,
      labelX,
      label1: `${farthest.code} — ${fmtMi(farthest.distanceMi)} mi`,
      label2: 'your longest reach',
    }
  }

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      width="100%"
      height="100%"
      style={{ display: 'block', maxWidth: 680, margin: '0 auto' }}
      role="img"
      aria-label="Polar plot of destinations by compass bearing and distance from home"
    >
      <defs>
        <radialGradient id="rb-homeglow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ff3d57" />
          <stop offset="45%" stopColor="#ff2fa8" />
          <stop offset="100%" stopColor="#6a3cff" />
        </radialGradient>
        <radialGradient id="rb-homehalo" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ff2fa8" stopOpacity={0.3} />
          <stop offset="100%" stopColor="#ff2fa8" stopOpacity={0} />
        </radialGradient>
        <radialGradient id="rb-fade" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f7f3ec" stopOpacity={0} />
          <stop offset="66%" stopColor="#f7f3ec" stopOpacity={0} />
          <stop offset="100%" stopColor="#f7f3ec" stopOpacity={0.85} />
        </radialGradient>
      </defs>

      {/* faint concentric distance rings (sqrt-scaled) */}
      {rings.map((mi, i) => {
        const r = ringRadius(mi)
        const isOuter = i === rings.length - 1
        return (
          <circle
            key={`ring${i}`}
            cx={CX}
            cy={CY}
            r={r.toFixed(2)}
            fill="none"
            stroke={isOuter ? '#e3dccf' : '#ece6db'}
            strokeWidth={1}
            strokeDasharray={isOuter ? '2 4' : undefined}
          />
        )
      })}

      {/* compass spokes (N–S, E–W, and the two diagonals) */}
      <g stroke="#efe8db" strokeWidth={1}>
        <line x1={CX} y1={CY - R_MAX} x2={CX} y2={CY + R_MAX} />
        <line x1={CX - R_MAX} y1={CY} x2={CX + R_MAX} y2={CY} />
        {[45, 135].map((ang) => {
          const a = polar(CX, CY, R_MAX, ang)
          const b = polar(CX, CY, R_MAX, ang + 180)
          return <line key={ang} x1={a.x.toFixed(1)} y1={a.y.toFixed(1)} x2={b.x.toFixed(1)} y2={b.y.toFixed(1)} />
        })}
      </g>

      {/* ring mileage labels, riding the N (up) spoke on a small white pill */}
      <g fontFamily="var(--font)" fontSize={8.5} fontWeight={600} fill="#9aa0ac">
        {rings.map((mi, i) => {
          const r = ringRadius(mi)
          if (r < 12) return null // too close to home to label
          const y = CY - r
          const isOuter = i === rings.length - 1
          const text = isOuter ? `${ringLabel(mi)} mi` : ringLabel(mi)
          const w = text.length * 5 + 6
          return (
            <g key={`rlabel${i}`}>
              <rect x={CX + 4} y={y - 5.5} width={w} height={11} rx={2} fill="#fff" opacity={0.85} />
              <text x={CX + 6} y={y + 3} fill={isOuter ? '#c0b8a8' : '#9aa0ac'}>{text}</text>
            </g>
          )
        })}
      </g>

      {/* radial fade so the outer rim reads soft */}
      <circle cx={CX} cy={CY} r={R_MAX + 12} fill="url(#rb-fade)" />

      {/* compass ticks N E S W */}
      <g fontFamily="var(--font)" fontSize={11} fontWeight={700} fill="var(--ink-2)" textAnchor="middle">
        <text x={CX} y={CY - R_MAX - 8}>N</text>
        <text x={CX + R_MAX + 10} y={CY + 4}>E</text>
        <text x={CX} y={CY + R_MAX + 16}>S</text>
        <text x={CX - R_MAX - 10} y={CY + 4}>W</text>
      </g>

      {/* ── destination dots ── */}
      {drawn.map((d, i) => {
        const p = polar(CX, CY, ringRadius(d.distanceMi), d.bearing)
        const r = dotRadius(d.visits)
        return (
          <circle
            key={`${d.code}-${i}`}
            cx={p.x.toFixed(2)}
            cy={p.y.toFixed(2)}
            r={r.toFixed(2)}
            fill={colorFor(d.continent)}
            fillOpacity={0.88}
            stroke="#fff"
            strokeWidth={0.8}
            style={onPick ? { cursor: 'pointer' } : undefined}
            onClick={onPick ? () => onPick(d) : undefined}
          >
            <title>{`${d.code} · ${d.municipality || d.name} — ${fmtMi(d.distanceMi)} mi · ${d.visits} visit${d.visits === 1 ? '' : 's'}`}</title>
          </circle>
        )
      })}

      {/* ── the ONE annotation: leader-line to the farthest destination ── */}
      {anno && (
        <g fontFamily="var(--font)">
          <circle cx={anno.px.toFixed(2)} cy={anno.py.toFixed(2)} r={dotRadius(farthest!.visits) + 3.5} fill="none" stroke="var(--magenta)" strokeWidth={1} opacity={0.5} />
          <line
            x1={anno.px.toFixed(1)}
            y1={anno.py.toFixed(1)}
            x2={anno.labelX < CX ? (anno.labelX + 46).toFixed(1) : (anno.labelX - 46).toFixed(1)}
            y2={anno.py.toFixed(1)}
            stroke="var(--magenta)"
            strokeWidth={1}
            opacity={0.55}
          />
          <text x={anno.labelX} y={anno.py - 6} fontSize={9.5} fontWeight={700} fill="var(--ink)" textAnchor={anno.labelX < CX ? 'start' : 'end'}>
            {anno.label1}
          </text>
          <text x={anno.labelX} y={anno.py + 5} fontSize={9} fill="var(--ink-2)" textAnchor={anno.labelX < CX ? 'start' : 'end'}>
            {anno.label2}
          </text>
        </g>
      )}

      {/* ── home at the center: halo + hero-gradient core + label ── */}
      <circle cx={CX} cy={CY} r={26} fill="url(#rb-homehalo)" />
      <circle cx={CX} cy={CY} r={7.5} fill="url(#rb-homeglow)" />
      <circle cx={CX} cy={CY} r={7.5} fill="none" stroke="#fff" strokeWidth={1.5} />
      <text
        x={CX}
        y={CY + 25}
        fontFamily="var(--font)"
        fontSize={8.5}
        fontWeight={700}
        fill="var(--indigo)"
        textAnchor="middle"
        letterSpacing="0.06em"
      >
        {homeLabel ? `HOME · ${homeLabel}` : 'HOME'}
      </text>
    </svg>
  )
}
