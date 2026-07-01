/**
 * Pure helpers for "The Body-Clock" 24-hour circadian dial.
 *
 * The honest core: a flight's timezone shift is the gap between how much the LOCAL
 * wall clock advanced and how much time REALLY elapsed. Fly west and the wall clock
 * lags real time (you "gain" hours); fly east and it races ahead (you "lose" hours).
 */
import type { EnrichedFlight } from '../../engine'

export type TzDir = 'east' | 'west' | 'same'

/**
 * Direction of the timezone change for one flight.
 *
 *   trueElapsedMin  = (arrUtcMs − depUtcMs)/60000, else fall back to durationMin.
 *   localElapsedMin = wall-clock hours advanced (mod 24) × 60.
 *   shiftHours      = round((localElapsed − trueElapsed) / 60).
 *
 *   shiftHours > 0 → wall clock advanced MORE than real time → flew WEST / gained time.
 *   shiftHours < 0 → flew EAST / lost time.
 *   shiftHours = 0 → same zone.
 *
 * Missing local hours, or no way to compute true elapsed (no UTC instants and no
 * durationMin), both read 'same' — never throw, never fabricate a direction.
 */
export function tzDirection(f: EnrichedFlight): TzDir {
  if (f.depHourLocal == null || f.arrHourLocal == null) return 'same'

  let trueElapsedMin: number | null = null
  if (f.depUtcMs != null && f.arrUtcMs != null) {
    trueElapsedMin = (f.arrUtcMs - f.depUtcMs) / 60000
  } else if (f.durationMin != null) {
    trueElapsedMin = f.durationMin
  }
  if (trueElapsedMin == null) return 'same'

  const localElapsedMin = ((((f.arrHourLocal - f.depHourLocal) % 24) + 24) % 24) * 60
  const shiftHours = Math.round((localElapsedMin - trueElapsedMin) / 60)

  if (shiftHours > 0) return 'west'
  if (shiftHours < 0) return 'east'
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
