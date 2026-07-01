/**
 * Pure helpers for "The Body-Clock" 24-hour circadian dial.
 *
 * The honest core: fly EAST and you cross into later time zones — the wall clock jumps
 * forward PAST the real elapsed time (you "lose" hours); fly WEST and it lags real time
 * (you "gain" hours). We read that direction from the airports' true UTC offsets when we
 * have them, and fall back to the wall-clock-vs-real-elapsed gap otherwise.
 */
import { DateTime } from 'luxon'
import type { EnrichedFlight } from '../../engine'

export type TzDir = 'east' | 'west' | 'same'

/**
 * Direction of the timezone change for one flight — the dial's hue.
 *
 * Primary (exact): the difference in true UTC offsets between destination and origin at
 * the flight's instants (both airports carry an IANA tz):
 *   destinationOffset − originOffset > 0 → destination is further EAST → 'east' (lose time)
 *                                     < 0 → 'west' (gain time)
 *                                     = 0 → 'same' zone.
 *
 * Fallback (when tz or UTC instants are missing): the gap between how much the LOCAL wall
 * clock advanced (whole hours only) and how much time REALLY elapsed. Because local hours
 * are integer-truncated, a ±90-minute dead-band keeps minute-rounding from fabricating a
 * 1-hour shift on a same-zone hop:
 *   (wallAdvanced − trueElapsed) ≥ +90m → 'east'   ≤ −90m → 'west'   else → 'same'.
 *
 * Missing local hours, or no way to compute true elapsed, read 'same' — never throw,
 * never fabricate a direction.
 */
export function tzDirection(f: EnrichedFlight): TzDir {
  // Primary: exact tz-offset difference at the flight's instants.
  if (f.from?.tz && f.to?.tz && f.depUtcMs != null && f.arrUtcMs != null) {
    const depOff = DateTime.fromMillis(f.depUtcMs, { zone: f.from.tz }).offset
    const arrOff = DateTime.fromMillis(f.arrUtcMs, { zone: f.to.tz }).offset
    if (Number.isFinite(depOff) && Number.isFinite(arrOff)) {
      const shift = arrOff - depOff
      if (shift > 0) return 'east'
      if (shift < 0) return 'west'
      return 'same'
    }
  }

  // Fallback: wall-clock advance vs. true elapsed (whole-hour local data only).
  if (f.depHourLocal == null || f.arrHourLocal == null) return 'same'
  let trueElapsedMin: number | null = null
  if (f.depUtcMs != null && f.arrUtcMs != null) {
    trueElapsedMin = (f.arrUtcMs - f.depUtcMs) / 60000
  } else if (f.durationMin != null) {
    trueElapsedMin = f.durationMin
  }
  if (trueElapsedMin == null) return 'same'

  const localElapsedMin = ((((f.arrHourLocal - f.depHourLocal) % 24) + 24) % 24) * 60
  const diff = localElapsedMin - trueElapsedMin // wall advanced − real elapsed
  if (diff >= 90) return 'east' // wall jumped forward past real time → lost time → east
  if (diff <= -90) return 'west'
  return 'same'
}

/**
 * The most common local departure hour across the flights, with its count.
 * Ignores flights whose depHourLocal is null. Ties break toward the EARLIER hour
 * (deterministic). Returns null when no flight has a departure hour.
 */
export function modalDepartureHour(
  flights: EnrichedFlight[],
): { hour: number; count: number } | null {
  const counts = new Map<number, number>()
  for (const f of flights) {
    if (f.depHourLocal == null) continue
    counts.set(f.depHourLocal, (counts.get(f.depHourLocal) ?? 0) + 1)
  }
  let best: { hour: number; count: number } | null = null
  for (const [hour, count] of counts) {
    if (!best || count > best.count || (count === best.count && hour < best.hour)) {
      best = { hour, count }
    }
  }
  return best
}
