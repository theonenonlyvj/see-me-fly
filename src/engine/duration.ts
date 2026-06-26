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

const clampNonNeg = (n: number) => Math.max(0, n)

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

  // 1. actual air time
  if (raw.takeoffActual && raw.landingActual && fromTz && toTz) {
    const m = pairMinutes(raw.takeoffActual, fromTz, raw.landingActual, toTz)
    if (m !== null) return { min: Math.round(clampNonNeg(m)), source: 'actual' }
  }
  // 2. scheduled air time
  if (raw.takeoffSched && raw.landingSched && fromTz && toTz) {
    const m = pairMinutes(raw.takeoffSched, fromTz, raw.landingSched, toTz)
    if (m !== null) return { min: Math.round(clampNonNeg(m)), source: 'scheduled' }
  }
  // 3. gate-to-gate (actual then scheduled) minus taxi allowance
  const gateDep = raw.gateDepActual || raw.gateDepSched
  const gateArr = raw.gateArrActual || raw.gateArrSched
  if (gateDep && gateArr && fromTz && toTz) {
    const m = pairMinutes(gateDep, fromTz, gateArr, toTz)
    if (m !== null) {
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
