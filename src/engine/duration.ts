import { DateTime } from 'luxon'
import type { Airport, RawFlight, DurationConstants, DurationSource } from './types'

export function localToUtcMs(localIso: string, tz: string): number | null {
  if (!localIso || !tz) return null
  const dt = DateTime.fromISO(localIso, { zone: tz })
  return dt.isValid ? dt.toMillis() : null
}

function pairMinutes(aIso: string, aTz: string, bIso: string, bTz: string): number | null {
  const a = localToUtcMs(aIso, aTz)
  const b = localToUtcMs(bIso, bTz)
  if (a === null || b === null) return null
  return (b - a) / 60000
}

// Faster than any airliner's ground speed even in extreme jet-stream tailwinds (real ground speeds
// top out around ~780-800mph in rare strong westerlies). A time-based air/gate time implying more
// than this for the route's distance is bad data (degenerate timestamps), not a real short flight.
const MAX_GROUND_MPH = 800

export function computeDuration(args: {
  from: Airport | null
  to: Airport | null
  raw: RawFlight
  distanceMi: number | null
  constants: DurationConstants
}): { min: number | null; source: DurationSource | null } {
  const { from, to, raw, distanceMi, constants: c } = args
  const fromTz = from?.tz ?? ''
  const toTz = to?.tz ?? ''

  // A time-based tier is accepted only if it yields a POSITIVE, physically-plausible duration.
  // Degenerate pairs (takeoff == landing, or near-equal/date-only timestamps common in older Flighty
  // exports) compute to <= 0 or an impossibly small air time for the distance; rather than report a
  // 0/1/3-minute "actual", we fall through to the next-best source so the flight still gets a
  // realistic estimate. (Fixed ~29% of one real export whose 0-minute actuals polluted totals,
  // averages, and the shortest-flights view.)
  const plausible = (m: number | null): m is number => {
    if (m === null || m <= 0) return false
    if (distanceMi !== null && distanceMi > 0 && m < (distanceMi / MAX_GROUND_MPH) * 60) return false
    return true
  }

  // 1. actual air time
  if (raw.takeoffActual && raw.landingActual && fromTz && toTz) {
    const m = pairMinutes(raw.takeoffActual, fromTz, raw.landingActual, toTz)
    if (plausible(m)) return { min: Math.round(m), source: 'actual' }
  }
  // 2. scheduled air time
  if (raw.takeoffSched && raw.landingSched && fromTz && toTz) {
    const m = pairMinutes(raw.takeoffSched, fromTz, raw.landingSched, toTz)
    if (plausible(m)) return { min: Math.round(m), source: 'scheduled' }
  }
  // 3. gate-to-gate (actual then scheduled) minus taxi allowance
  const gateDep = raw.gateDepActual || raw.gateDepSched
  const gateArr = raw.gateArrActual || raw.gateArrSched
  if (gateDep && gateArr && fromTz && toTz) {
    const m = pairMinutes(gateDep, fromTz, gateArr, toTz)
    // gate-to-gate includes taxi so it's longer than air time; same plausibility floor still rejects
    // degenerate near-zero gate spans, falling through to the distance estimate.
    if (plausible(m)) {
      return { min: Math.round(Math.max(c.localFlightMinMin, m - c.gateTaxiMin)), source: 'gate' }
    }
  }
  // 4a. zero-distance local flight with no usable times -> default
  if (distanceMi === 0) {
    return { min: c.localFlightDefaultMin, source: 'localDefault' }
  }
  // 4b. distance estimate
  if (distanceMi !== null && distanceMi > 0) {
    const est = c.taxiMin + (distanceMi / c.cruiseMph) * 60 + c.climbDescentMin
    return { min: Math.round(est), source: 'estimate' }
  }
  return { min: null, source: null }
}
