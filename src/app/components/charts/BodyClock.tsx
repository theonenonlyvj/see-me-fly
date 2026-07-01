import { polar } from '../../lib/polar'
import type { TzDir } from '../../lib/body-clock'

/**
 * "The Body-Clock" — a 24-hour circadian dial (midnight at TOP, noon at BOTTOM,
 * 6a at the RIGHT, 6p at the LEFT; hour h → angle h/24·360, clockwise via polar()).
 *
 * Each placeable flight is ONE thin, very-low-opacity arc drawn along the rim from its
 * local departure hour to its local arrival hour. Opacity is tiny (~0.07) on purpose:
 * overlap ACCUMULATES into tone, so the busy hours darken from real density — never a
 * fabricated fill. Hue encodes the direction of the timezone change: east (lose time) in
 * indigo/magenta, west (gain time) in sky/lime, same-zone in muted ink-grey.
 *
 * A faint night terminator band (~21:00→06:00) sits behind the arcs; the center holds the
 * total placeable-flight count; small ticks mark 12a/6a/12p/6p with a moon/sun touch.
 */

const SIZE = 300
const CX = SIZE / 2
const CY = SIZE / 2
const R_OUT = 130 // outer rim of the arc band
const R_IN = 72 // inner rim of the arc band
const R_TICK = 136
const R_LABEL = 118

/** Hour (0..24, may exceed 24 for a midnight-wrapping arc) → angle in polar()'s frame. */
function hourAngle(h: number): number {
  return (h / 24) * 360
}

/** A point on the dial at radius r and hour h. */
function pt(r: number, h: number): { x: number; y: number } {
  return polar(CX, CY, r, hourAngle(h))
}

/**
 * SVG path 'd' for an arc along a constant radius from hour h0 sweeping `sweep` hours
 * clockwise. Polyline-approximated (a few points per hour) so any sweep — including one
 * that wraps past midnight — renders smoothly without SVG large-arc/sweep-flag bookkeeping.
 */
function arcPath(r: number, h0: number, sweep: number): string {
  const steps = Math.max(3, Math.round(sweep * 4))
  let d = ''
  for (let i = 0; i <= steps; i++) {
    const hh = h0 + sweep * (i / steps)
    const p = pt(r, hh)
    d += (i === 0 ? 'M' : 'L') + p.x.toFixed(2) + ',' + p.y.toFixed(2)
  }
  return d
}

/** Filled annulus wedge from hour h0→h1 between rIn and rOut (the night band). */
function annulusWedge(h0: number, h1: number, rIn: number, rOut: number): string {
  const steps = 64
  const outer: string[] = []
  const inner: string[] = []
  for (let i = 0; i <= steps; i++) {
    const h = h0 + (h1 - h0) * (i / steps)
    const po = pt(rOut, h)
    outer.push(po.x.toFixed(2) + ',' + po.y.toFixed(2))
  }
  for (let j = steps; j >= 0; j--) {
    const h = h0 + (h1 - h0) * (j / steps)
    const pi = pt(rIn, h)
    inner.push(pi.x.toFixed(2) + ',' + pi.y.toFixed(2))
  }
  return 'M' + [...outer, ...inner].join('L') + 'Z'
}

/** One flight's arc, already placed: local dep hour, sweep (arr − dep, mod 24), direction, radius. */
export interface DialArc {
  depHour: number
  sweep: number
  dir: TzDir
  /** radius within the band; the card jitters these so arcs don't stack into one line. */
  r: number
  /** true for a long haul (thicker, slightly more opaque). */
  long: boolean
}

const HUE: Record<TzDir, string> = {
  east: 'var(--indigo)', // lose time
  west: 'var(--sky)', // gain time
  same: '#b9bec9', // muted ink-grey
}
const HUE_ALT: Record<TzDir, string> = {
  east: 'var(--magenta)',
  west: 'var(--lime)',
  same: '#b9bec9',
}

export interface BodyClockProps {
  arcs: DialArc[]
  /** total placeable flights (shown big in the center). */
  total: number
  /** modal departure hour to mark on the rim, or null. */
  modalHour?: number | null
}

export default function BodyClock({ arcs, total, modalHour }: BodyClockProps) {
  const majorLabels: [number, string][] = [
    [0, '12a'],
    [6, '6a'],
    [12, '12p'],
    [18, '6p'],
  ]

  // Draw long-haul arcs last (on top) so their heavier tone reads over the dense short-hop wash.
  const ordered = [...arcs].sort((a, b) => Number(a.long) - Number(b.long))

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      width="100%"
      height="100%"
      style={{ display: 'block', maxWidth: 340, margin: '0 auto' }}
      role="img"
      aria-label="24-hour body clock: one thin arc per flight from local departure to arrival hour, midnight at top"
    >
      <defs>
        <radialGradient id="bcDisc" cx="50%" cy="45%" r="64%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="66%" stopColor="#fcf9f3" />
          <stop offset="100%" stopColor="#f2ede3" />
        </radialGradient>
        <radialGradient id="bcNight" cx="50%" cy="50%" r="56%">
          <stop offset="52%" stopColor="rgba(24,20,46,0)" />
          <stop offset="80%" stopColor="rgba(28,23,60,0.09)" />
          <stop offset="100%" stopColor="rgba(20,17,52,0.16)" />
        </radialGradient>
      </defs>

      {/* the paper disc */}
      <circle cx={CX} cy={CY} r={R_OUT + 4} fill="url(#bcDisc)" stroke="var(--hair)" strokeWidth={1} />

      {/* faint night terminator band behind the arcs (~21:00 → 06:00, i.e. 21 → 30) */}
      <path d={annulusWedge(21, 30, R_IN - 6, R_OUT + 4)} fill="#2a2350" opacity={0.13} />
      <circle cx={CX} cy={CY} r={R_OUT + 4} fill="url(#bcNight)" />

      {/* inner dead-zone disc */}
      <circle cx={CX} cy={CY} r={R_IN - 6} fill="#ffffff" stroke="#f0ebe1" strokeWidth={1} />

      {/* the per-flight arcs — low opacity, tone from overlap */}
      <g>
        {ordered.map((a, i) => {
          const stroke = (a.long ? HUE_ALT : HUE)[a.dir]
          const opacity = a.dir === 'same' ? 0.05 : a.long ? 0.09 : 0.065
          const width = a.long ? 1.5 : 1.05
          return (
            <path
              key={i}
              d={arcPath(a.r, a.depHour, a.sweep)}
              fill="none"
              stroke={stroke}
              strokeWidth={width}
              strokeLinecap="round"
              opacity={opacity}
            />
          )
        })}
      </g>

      {/* hour ticks (major every 6h) */}
      <g>
        {Array.from({ length: 24 }, (_, h) => {
          const major = h % 6 === 0
          const a = pt(R_TICK, h)
          const b = pt(R_TICK - (major ? 9 : 5), h)
          return (
            <line
              key={`t${h}`}
              x1={a.x.toFixed(2)}
              y1={a.y.toFixed(2)}
              x2={b.x.toFixed(2)}
              y2={b.y.toFixed(2)}
              stroke={major ? '#9aa0ad' : '#d9d4c8'}
              strokeWidth={major ? 1.4 : 1}
              strokeLinecap="round"
            />
          )
        })}
        {majorLabels.map(([h, label]) => {
          const p = pt(R_LABEL, h)
          return (
            <text
              key={`l${h}`}
              x={p.x.toFixed(2)}
              y={(p.y + 3.6).toFixed(2)}
              textAnchor="middle"
              fontFamily="var(--font)"
              fontSize={11}
              fontWeight={700}
              fill="var(--ink-2)"
            >
              {label}
            </text>
          )
        })}
      </g>

      {/* moon at midnight (top), sun at noon (bottom) */}
      <text x={pt(R_IN + 13, 0).x} y={pt(R_IN + 13, 0).y + 5} textAnchor="middle" fontSize={12} aria-hidden>
        🌙
      </text>
      <text x={pt(R_IN + 13, 12).x} y={pt(R_IN + 13, 12).y + 5} textAnchor="middle" fontSize={12} aria-hidden>
        ☀️
      </text>

      {/* the ONE rim annotation: the modal departure hour */}
      {modalHour != null && (
        (() => {
          const p = pt(R_OUT + 4, modalHour + 0.2)
          return (
            <circle
              cx={p.x.toFixed(2)}
              cy={p.y.toFixed(2)}
              r={3.6}
              fill="var(--tangerine)"
              stroke="#fff"
              strokeWidth={1.6}
            />
          )
        })()
      )}

      {/* center: total placeable flights */}
      <text
        x={CX}
        y={CY - 2}
        textAnchor="middle"
        fontFamily="var(--font-display)"
        fontWeight={600}
        fontSize={22}
        fill="var(--ink)"
      >
        {total.toLocaleString('en-US')}
      </text>
      <text
        x={CX}
        y={CY + 13}
        textAnchor="middle"
        fontFamily="var(--font)"
        fontSize={9}
        fontWeight={700}
        letterSpacing="0.12em"
        fill="#8a8fa0"
      >
        FLIGHTS
      </text>
    </svg>
  )
}
