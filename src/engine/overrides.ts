import type { RawFlight } from './types'
import raw from '../reference/flight-overrides.json'

export interface FlightOverride {
  signature: string
  durationMinOverride?: number | null
  distanceMiOverride?: number | null
  from?: string
  to?: string
  exclude?: boolean
  note?: string
}

const overrides = (raw as { overrides: FlightOverride[] }).overrides ?? []
const index = new Map<string, FlightOverride>()
for (const o of overrides) index.set(o.signature, o)

export function signatureOf(r: RawFlight): string {
  return `${r.date}|${r.fromCode}|${r.toCode}|${r.gateDepSched}`
}

export function overrideFor(r: RawFlight): FlightOverride | null {
  return index.get(signatureOf(r)) ?? null
}
