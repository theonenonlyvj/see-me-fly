import type { RibbonYear, RibbonTier, HomeAwayStretch } from '../../../engine/stats'
import { dayOfYear } from '../../lib/polar'

/**
 * "Home & Away" — a calm per-year ribbon calendar of presence vs. absence. ONE encoding:
 * one thin row per year (ascending top→bottom); the X axis is the day of the year (Jan 1 left →
 * Dec 31 right). Every day is either HOME (bare warm paper — negative space carries the story) or
 * AWAY (a filled block colored by the trip's farthest reach). No sparkline, no mosaic hatching
 * fight — restraint is the point.
 *
 * Honesty:
 *  - Away blocks are drawn to their true day-span (count-honest; no area inflation).
 *  - A block from a trip with an INFERRED boundary is overlaid with a faint diagonal hatch, so
 *    reconstructed nights never read as measured ones.
 *  - The "NN% away" per row is a real fraction of that year's days; the two bracket annotations
 *    mark the actual longest home stretch and longest away stint.
 */

const TIER_COLOR: Record<RibbonTier, string> = {
  domestic: 'var(--lime)',       // #12c08a — stayed on the home continent
  transatlantic: 'var(--indigo)', // #6a3cff — EU / AF / SA (other intercontinental)
  transpacific: 'var(--magenta)', // #ff2fa8 — AS / OC
}

// Cumulative days before each month start (non-leap) → for faint month gridlines/labels.
const MONTH_STARTS_DOY = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335]
const MONTH_LETTERS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function fmtMonYr(date: string): string {
  const mi = Number(date.slice(5, 7)) - 1
  return `${MONTH_NAMES[mi] ?? '?'} ${date.slice(0, 4)}`
}
/** A compact human range: "Jul–Aug 2019" (same year) or "Dec 2019–Jan 2020". */
function fmtRange(a: string, b: string): string {
  const ay = a.slice(0, 4), by = b.slice(0, 4)
  const am = MONTH_NAMES[Number(a.slice(5, 7)) - 1] ?? '?'
  const bm = MONTH_NAMES[Number(b.slice(5, 7)) - 1] ?? '?'
  if (ay === by) return am === bm ? `${am} ${ay}` : `${am}–${bm} ${ay}`
  return `${am} ${ay}–${bm} ${by}`
}

export interface HomeAwayRibbonProps {
  rows: RibbonYear[]
  longestHome: HomeAwayStretch | null
  longestAway: HomeAwayStretch | null
}

// Layout geometry.
const PAD_L = 46   // room for the "’YY" year label
const PAD_R = 66   // room for the right-aligned "NN% away"
const PAD_T = 20   // room for the month letters along the top
const PAD_B = 8
const ROW_H = 15   // per-year row band height
const ROW_GAP = 5
const BAR_H = 9    // away-block / home-baseline thickness

export default function HomeAwayRibbon({ rows, longestHome, longestAway }: HomeAwayRibbonProps) {
  const W = 620
  const plotW = W - PAD_L - PAD_R
  const H = PAD_T + rows.length * (ROW_H + ROW_GAP) - ROW_GAP + PAD_B

  // Day-of-year (1..) → x. Uses a 366 span so leap years reach the right edge without clipping.
  const xForDoy = (doy: number) => PAD_L + ((doy - 1) / 365) * plotW
  const rowTop = (i: number) => PAD_T + i * (ROW_H + ROW_GAP)
  const rowMid = (i: number) => rowTop(i) + ROW_H / 2
  const yearIndex = new Map(rows.map((r, i) => [r.year, i]))

  // Bracket placement for an extremum: its row (by start-date year) + x-span within that year.
  const bracketFor = (s: HomeAwayStretch | null) => {
    if (!s) return null
    const y = Number(s.startDate.slice(0, 4))
    const i = yearIndex.get(y)
    if (i == null) return null
    // Clip to the start year's row (a cross-year stretch just draws its start-year portion).
    const x0 = xForDoy(dayOfYear(s.startDate))
    const endSameYear = Number(s.endDate.slice(0, 4)) === y
    const x1 = endSameYear ? xForDoy(dayOfYear(s.endDate)) : PAD_L + plotW
    return { i, x0, x1 }
  }
  const homeB = bracketFor(longestHome)
  const awayB = bracketFor(longestAway)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" role="img"
      aria-label="Home and away ribbon: one row per year, day of year left to right, colored blocks are trips away from home"
      style={{ display: 'block', maxWidth: W, margin: '0 auto', overflow: 'visible' }}>
      <defs>
        {/* diagonal hatch overlay for estimated-boundary trips (subtle white lines) */}
        <pattern id="ha-hatch" width={4} height={4} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1={0} y1={0} x2={0} y2={4} stroke="#ffffff" strokeOpacity={0.5} strokeWidth={1.4} />
        </pattern>
      </defs>

      {/* faint month gridlines + top month letters, spanning all rows */}
      {MONTH_STARTS_DOY.map((doy, m) => {
        const x = xForDoy(doy)
        return (
          <g key={`mo${m}`}>
            <line x1={x} y1={PAD_T - 4} x2={x} y2={H - PAD_B} stroke="var(--hair)" strokeWidth={0.7} strokeOpacity={m === 0 ? 0.9 : 0.5} />
            <text x={x + 1.5} y={PAD_T - 9} fontSize={8} fill="#b3ac9e" fontFamily="var(--font)" fontWeight={700} textAnchor="start">{MONTH_LETTERS[m]}</text>
          </g>
        )
      })}

      {rows.map((r, i) => {
        const top = rowTop(i)
        const mid = rowMid(i)
        const pct = r.totalDays > 0 ? Math.round((r.awayDays / r.totalDays) * 100) : 0
        return (
          <g key={r.year}>
            {/* year label ('YY) */}
            <text x={PAD_L - 9} y={mid + 3.2} fontSize={9.5} fill="var(--ink-2)" fontFamily="var(--font)" fontWeight={600} textAnchor="end">
              {"’" + String(r.year).slice(2)}
            </text>
            {/* home baseline: bare warm paper with a hairline, full width (home = negative space) */}
            <rect x={PAD_L} y={mid - BAR_H / 2} width={plotW} height={BAR_H} rx={2.5} fill="var(--paper)" stroke="var(--hair)" strokeWidth={1} />
            {/* away blocks */}
            {r.spans.map((sp, si) => {
              const x0 = xForDoy(sp.startDoy)
              // +1 so a single away day still has width; clamp so a leap-year Dec-31
              // (doy 366 → xForDoy(367)) doesn't overshoot the right gridline.
              const x1 = Math.min(PAD_L + plotW, xForDoy(sp.endDoy + 1))
              const w = Math.max(1.6, x1 - x0)
              return (
                <g key={si}>
                  <rect x={x0} y={mid - BAR_H / 2} width={w} height={BAR_H} rx={2} fill={TIER_COLOR[sp.tier]} />
                  {sp.estimated && <rect x={x0} y={mid - BAR_H / 2} width={w} height={BAR_H} rx={2} fill="url(#ha-hatch)" />}
                </g>
              )
            })}
            {/* right-margin "NN% away" (text only — never an overlaid line) */}
            <text x={W - 4} y={mid + 3.2} fontSize={9} fontFamily="var(--font)" fontWeight={pct >= 20 ? 700 : 500}
              fill={pct >= 20 ? 'var(--ink)' : 'var(--ink-2)'} textAnchor="end">
              {pct}% away
            </text>
            {/* row baseline under the paper, very faint, to keep the grid readable */}
            <line x1={PAD_L} y1={top + ROW_H + ROW_GAP / 2} x2={PAD_L + plotW} y2={top + ROW_H + ROW_GAP / 2} stroke="var(--hair-2)" strokeWidth={0.5} strokeOpacity={0.6} />
          </g>
        )
      })}

      {/* ── the two bracket annotations (below the away block / above the home stretch) ── */}
      {awayB && longestAway && (
        <Bracket x0={awayB.x0} x1={awayB.x1} yc={rowMid(awayB.i)} color="var(--indigo)" below
          label={`${longestAway.days} days away · ${fmtRange(longestAway.startDate, longestAway.endDate)}`} />
      )}
      {homeB && longestHome && (
        <Bracket x0={homeB.x0} x1={homeB.x1} yc={rowMid(homeB.i)} color="var(--ink-2)"
          label={`${longestHome.days} days home · ${fmtMonYr(longestHome.startDate)}`} />
      )}
    </svg>
  )
}

/** A small bracket + centered label above (default) or below a row's baseline. */
function Bracket({ x0, x1, yc, label, color, below }: { x0: number; x1: number; yc: number; label: string; color: string; below?: boolean }) {
  const y = below ? yc + 8 : yc - 8
  const tick = below ? 4 : -4
  const ty = below ? y + 11 : y - 4
  const mid = (x0 + x1) / 2
  return (
    <g>
      <path d={`M${x0.toFixed(1)},${(y - tick).toFixed(1)} L${x0.toFixed(1)},${y.toFixed(1)} L${x1.toFixed(1)},${y.toFixed(1)} L${x1.toFixed(1)},${(y - tick).toFixed(1)}`}
        fill="none" stroke={color} strokeWidth={1.1} strokeLinejoin="round" />
      <text x={mid} y={ty} fontSize={8.5} fill={color} fontFamily="var(--font)" fontWeight={700} textAnchor="middle">{label}</text>
    </g>
  )
}

/** The three-swatch legend (Domestic / Transatlantic / Transpacific), for the card to render. */
export const HOME_AWAY_LEGEND: { label: string; tier: RibbonTier }[] = [
  { label: 'Domestic', tier: 'domestic' },
  { label: 'Transatlantic', tier: 'transatlantic' },
  { label: 'Transpacific', tier: 'transpacific' },
]
export const HOME_AWAY_TIER_COLOR = TIER_COLOR
