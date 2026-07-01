import { dayOfYear } from '../../lib/polar'

/**
 * "Allegiance" — a horizontal streamgraph (ThemeRiver). Time flows L→R across the years; each
 * FEATURED carrier is a smooth flowing band whose vertical THICKNESS at each year = that carrier's
 * flights that year; everything else is folded into a muted "Other" band. Bands are stacked around a
 * CENTER baseline (a symmetric "silhouette" offset: each year's total stack is centered on the mid
 * line) so the river breathes instead of sitting on a floor.
 *
 * Honesty: a streamgraph deliberately hides absolute magnitude (there's no zero baseline), so the
 * per-year TOTAL is redrawn as a faint tick strip along the top — the magnitude stays legible even
 * though the bands float. Edges are smoothed with a hand-rolled MONOTONE cubic (Fritsch–Carlson
 * tangent limiting) — no d3 dependency — and, crucially, adjacent bands SHARE the exact same edge
 * curve, so the smoothing can never make two bands cross or a band go negative-thickness.
 */

export interface StreamLayer {
  key: string       // stable id (carrier code, or 'other')
  label: string     // display name
  color: string     // fill
  counts: number[]  // per-year flight count, index-aligned to `years`
  featured: boolean // true = named carrier; false = the muted Other envelope
}

export interface StreamHome {
  /** YYYY-MM-DD of the home move (era.start). */
  date: string
  /** short label, e.g. "Dallas (DFW/DAL)". */
  label: string
}

export interface StreamGraphProps {
  years: number[]           // ascending, contiguous
  layers: StreamLayer[]     // draw order: featured (rank) first, Other last
  totals: number[]          // per-year TOTAL flights (all carriers), index-aligned to `years`
  homes?: StreamHome[]      // home-move hairlines (era.start dates)
  onPick?: (layer: StreamLayer) => void  // when set, carrier bands are clickable
}

// ── geometry ────────────────────────────────────────────────────────────────
const W = 720
const H = 340
const PAD_L = 14
const PAD_R = 14
const TICK_TOP = 10        // top of the honesty tick strip
const TICK_MAX_H = 20      // tallest total tick
const RIVER_TOP = 52       // bands live below the tick strip + its labels
const RIVER_BOT = 300      // above the x-axis labels
const AXIS_Y = 320
const MID = (RIVER_TOP + RIVER_BOT) / 2
const RIVER_H = RIVER_BOT - RIVER_TOP

/** x for a whole year index (evenly spaced across the plot). */
function xOfIndex(i: number, n: number): number {
  if (n <= 1) return (PAD_L + (W - PAD_R)) / 2
  return PAD_L + (i / (n - 1)) * (W - PAD_L - PAD_R)
}

/** x for an arbitrary date, by its year fraction (for home hairlines). Clamped to the plot. */
function xOfDate(date: string, years: number[]): number | null {
  const n = years.length
  if (n === 0) return null
  const y = Number(date.slice(0, 4))
  const frac = (dayOfYear(date) - 1) / 365.25
  // continuous "year index" position, e.g. 2019.5 → between the 2019 and 2020 columns
  const pos = (y - years[0]) + frac
  if (pos < -0.5 || pos > n - 0.5) return null // well outside the drawn range → skip
  const clamped = Math.max(0, Math.min(n - 1, pos))
  return xOfIndex(clamped, n)
}

// ── monotone cubic smoothing (hand-rolled; no deps) ──────────────────────────
/**
 * Build an SVG path segment string (a run of "C" cubics) through the given knots using
 * Fritsch–Carlson monotone tangents on y. Monotone limiting means the curve never overshoots
 * beyond its knot values — so when this same routine is used on two ordered boundaries, the
 * curves stay ordered and bands never cross. `xs` strictly increasing.
 */
function monotonePath(xs: number[], ys: number[]): string {
  const n = xs.length
  if (n === 0) return ''
  if (n === 1) return `L${xs[0].toFixed(2)},${ys[0].toFixed(2)}`

  // secant slopes
  const dx: number[] = []
  const slope: number[] = []
  for (let i = 0; i < n - 1; i++) {
    const h = xs[i + 1] - xs[i]
    dx.push(h)
    slope.push(h !== 0 ? (ys[i + 1] - ys[i]) / h : 0)
  }
  // tangents (Fritsch–Carlson)
  const m: number[] = new Array(n)
  m[0] = slope[0]
  m[n - 1] = slope[n - 2]
  for (let i = 1; i < n - 1; i++) {
    if (slope[i - 1] * slope[i] <= 0) {
      m[i] = 0 // local extremum → flat tangent (kills overshoot)
    } else {
      m[i] = (slope[i - 1] + slope[i]) / 2
    }
  }
  // limit tangents to keep monotonicity (|m| <= 3 * adjacent slope)
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) { m[i] = 0; m[i + 1] = 0; continue }
    const a = m[i] / slope[i]
    const b = m[i + 1] / slope[i]
    const s = a * a + b * b
    if (s > 9) {
      const t = 3 / Math.sqrt(s)
      m[i] = t * a * slope[i]
      m[i + 1] = t * b * slope[i]
    }
  }
  // emit cubic Béziers; control points at 1/3 of the tangent
  let d = ''
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i]
    const c1x = xs[i] + h / 3
    const c1y = ys[i] + (m[i] * h) / 3
    const c2x = xs[i + 1] - h / 3
    const c2y = ys[i + 1] - (m[i + 1] * h) / 3
    d += `C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${xs[i + 1].toFixed(2)},${ys[i + 1].toFixed(2)} `
  }
  return d.trim()
}

/** Closed band path: top boundary L→R (smoothed) then bottom boundary R→L (smoothed). */
function bandPath(xs: number[], topYs: number[], botYs: number[]): string {
  const n = xs.length
  if (n === 0) return ''
  const topD = monotonePath(xs, topYs)
  // bottom, reversed
  const rxs = [...xs].reverse()
  const rys = [...botYs].reverse()
  const botD = monotonePath(rxs, rys)
  const start = `M${xs[0].toFixed(2)},${topYs[0].toFixed(2)} `
  const toBot = ` L${rxs[0].toFixed(2)},${rys[0].toFixed(2)} `
  return `${start}${topD}${toBot}${botD} Z`
}

export default function StreamGraph({ years, layers, totals, homes, onPick }: StreamGraphProps) {
  const n = years.length
  if (n === 0 || layers.length === 0) return null

  const xs = years.map((_, i) => xOfIndex(i, n))

  // Peak stack (max per-year sum of the layers actually drawn) sets the vertical scale.
  const stackSums = years.map((_, i) => layers.reduce((s, L) => s + (L.counts[i] || 0), 0))
  const peakStack = Math.max(1, ...stackSums)
  // Scale so the tallest year fills ~90% of the river height.
  const yScale = (RIVER_H * 0.9) / peakStack

  // Cumulative boundary y-values per year. boundary[0] = top of first layer … boundary[L] = bottom.
  // Centered (silhouette) offset: each year's stack is centered on MID.
  const nB = layers.length + 1
  const boundaries: number[][] = Array.from({ length: nB }, () => new Array(n))
  for (let i = 0; i < n; i++) {
    const half = (stackSums[i] * yScale) / 2
    let acc = MID - half // top edge of the whole stack this year
    boundaries[0][i] = acc
    for (let k = 0; k < layers.length; k++) {
      acc += (layers[k].counts[i] || 0) * yScale
      boundaries[k + 1][i] = acc
    }
  }

  // Pre-smooth each boundary ONCE; adjacent bands reuse the identical curve → no crossing.
  // (bandPath re-runs monotonePath internally on the same knots, giving the shared edge.)

  // Label placement: for each featured layer, the year index where its band is fattest.
  const labelFor = (L: StreamLayer, k: number): { x: number; y: number } | null => {
    let bestI = -1
    let bestThick = 0
    for (let i = 0; i < n; i++) {
      const thick = (L.counts[i] || 0) * yScale
      if (thick > bestThick) { bestThick = thick; bestI = i }
    }
    if (bestI < 0 || bestThick < 12) return null // too thin to label in-band → rely on the legend
    const yMid = (boundaries[k][bestI] + boundaries[k + 1][bestI]) / 2
    return { x: xs[bestI], y: yMid }
  }

  // Total tick strip: each year's TOTAL flights as a short vertical tick, tallest = peak total.
  const peakTotal = Math.max(1, ...totals)

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      style={{ display: 'block' }}
      role="img"
      aria-label="Allegiance streamgraph: each carrier a flowing band, thickness = flights that year, stacked around a center baseline"
    >
      {/* ── honesty strip: per-year total ticks along the top (kept clear of all other labels) ── */}
      <line x1={PAD_L} y1={TICK_TOP + TICK_MAX_H} x2={W - PAD_R} y2={TICK_TOP + TICK_MAX_H} stroke="var(--hair)" strokeWidth={1} />
      {years.map((y, i) => {
        const h = (totals[i] / peakTotal) * TICK_MAX_H
        return (
          <rect
            key={`tick${y}`}
            x={xs[i] - 1.3}
            y={TICK_TOP + TICK_MAX_H - h}
            width={2.6}
            height={Math.max(0, h)}
            fill="#d3ccc0"
          >
            <title>{y}: {totals[i]} flights</title>
          </rect>
        )
      })}
      <text x={W - PAD_R} y={TICK_TOP + 8} textAnchor="end" fontSize={8.5} fill="#b7b1a5" fontFamily="var(--font)">
        top strip = flights / yr · peak {peakTotal}
      </text>

      {/* ── the river: one smooth band per layer (Other first so featured carriers sit atop it) ── */}
      {layers.map((L, k) => (
        <path
          key={L.key}
          d={bandPath(xs, boundaries[k], boundaries[k + 1])}
          fill={L.color}
          fillOpacity={L.featured ? 0.92 : 0.16}
          stroke={L.featured ? '#ffffff' : 'none'}
          strokeWidth={L.featured ? 0.6 : 0}
          strokeOpacity={0.5}
          style={onPick ? { cursor: 'pointer' } : undefined}
          onClick={onPick ? () => onPick(L) : undefined}
        >
          <title>{L.label}</title>
        </path>
      ))}

      {/* ── home-move hairlines (era.start) — faint & unlabeled. Text labels pile up
             unreadably for a well-travelled person with many relocations, so the moves
             are shown only as subtle "life changed here" ticks. ── */}
      {(homes ?? []).map((hm, i) => {
        const x = xOfDate(hm.date, years)
        if (x == null) return null
        return (
          <line key={`home${hm.date}-${i}`} x1={x} y1={RIVER_TOP - 2} x2={x} y2={RIVER_BOT}
            stroke="var(--ink)" strokeWidth={0.8} strokeDasharray="2 4" strokeOpacity={0.13} />
        )
      })}

      {/* ── in-band carrier labels on the fattest part (thin bands fall back to the legend) ── */}
      {layers.map((L, k) => {
        if (!L.featured) return null
        const pos = labelFor(L, k)
        if (!pos) return null
        return (
          <text
            key={`lbl${L.key}`}
            x={pos.x}
            y={pos.y + 3.5}
            textAnchor="middle"
            fontSize={11}
            fontWeight={700}
            fill="#ffffff"
            fontFamily="var(--font)"
            style={{ paintOrder: 'stroke' }}
            stroke={L.color}
            strokeWidth={0.5}
          >
            {L.label}
          </text>
        )
      })}

      {/* ── x-axis year labels ── */}
      {years.map((y, i) => {
        const step = n > 16 ? 3 : n > 9 ? 2 : 1
        if (i % step !== 0) return null
        return (
          <text key={`yr${y}`} x={xs[i]} y={AXIS_Y} textAnchor="middle" fontSize={9} fill="var(--ink-2)" fontFamily="var(--font)" style={{ fontVariantNumeric: 'tabular-nums' }}>
            &apos;{String(y).slice(2)}
          </text>
        )
      })}
    </svg>
  )
}
