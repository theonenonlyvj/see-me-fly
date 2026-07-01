/**
 * Small pure helpers for polar / radial charts.
 *
 * Screen SVG convention: y grows downward. Angles are measured with
 * 0° pointing UP (12 o'clock) and increasing CLOCKWISE — the natural
 * reading order for a month/hour clock.
 */

/**
 * Convert a polar coordinate to an SVG (x, y) point.
 * angle 0° = up (12 o'clock); increasing clockwise.
 *
 *   x = cx + r * sin(θ)
 *   y = cy − r * cos(θ)
 */
export function polar(cx: number, cy: number, r: number, angleDeg: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180
  return {
    x: cx + r * Math.sin(rad),
    y: cy - r * Math.cos(rad),
  }
}

/** True if `year` is a Gregorian leap year. */
function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

// Cumulative days before the start of each month (non-leap).
const DAYS_BEFORE_MONTH = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]

/**
 * Day-of-year (1..366) from a 'YYYY-MM-DD' string.
 * Parses the calendar fields directly — no Date/timezone math that could
 * shift the day across a UTC boundary.
 */
export function dayOfYear(date: string): number {
  const year = Number(date.slice(0, 4))
  const month = Number(date.slice(5, 7)) // 1..12
  const day = Number(date.slice(8, 10)) // 1..31
  let doy = DAYS_BEFORE_MONTH[month - 1] + day
  if (month > 2 && isLeapYear(year)) doy += 1
  return doy
}

/** Month index (0..11) from a 'YYYY-MM-DD' string. */
export function monthOfYear(date: string): number {
  return Number(date.slice(5, 7)) - 1
}
