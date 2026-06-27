import type { EnrichedFlight, RawFlight, DurationConstants } from './types'
import { lookupAirport, lookupAirline, classifyAircraft } from './reference'
import { haversineMi } from './distance'
import { computeDuration, localToUtcMs } from './duration'
import { overrideFor, type FlightOverride } from './overrides'

function hourOf(localIso: string): number | null {
  const m = /T(\d{2}):/.exec(localIso)
  return m ? Number(m[1]) : null
}

export function enrichFlight(
  raw: RawFlight,
  today: string,
  constants: DurationConstants,
  lookupOverride: (r: RawFlight) => FlightOverride | null = overrideFor,
): EnrichedFlight {
  const ov = lookupOverride(raw)
  const fromCode = (ov?.from ?? raw.fromCode).toUpperCase()
  const diverted = !!raw.divertedToCode
  const effectiveToRaw = ov?.to ?? (diverted ? raw.divertedToCode : raw.toCode)
  const toCode = effectiveToRaw.toUpperCase()
  const intendedToCode = diverted ? raw.toCode.toUpperCase() : null

  const from = lookupAirport(fromCode)
  const to = lookupAirport(toCode)
  const resolved = !!from && !!to
  const isLocalFlight = resolved && fromCode === toCode

  let distanceMi: number | null = null
  if (ov?.distanceMiOverride != null) distanceMi = ov.distanceMiOverride
  else if (isLocalFlight) distanceMi = 0
  else if (resolved) distanceMi = haversineMi(from!.lat, from!.lon, to!.lat, to!.lon)

  let durationMin: number | null
  let durationSource: EnrichedFlight['durationSource']
  if (ov?.durationMinOverride != null) {
    durationMin = ov.durationMinOverride
    durationSource = 'override'
  } else {
    const d = computeDuration({ from, to, raw, distanceMi, constants })
    durationMin = d.min
    durationSource = d.source
  }

  // delay: gate-arrival actual vs scheduled at the SAME airport (single tz -> naive diff is safe)
  let delayMin: number | null = null
  if (raw.gateArrActual && raw.gateArrSched) {
    const a = Date.parse(raw.gateArrActual)
    const s = Date.parse(raw.gateArrSched)
    if (Number.isFinite(a) && Number.isFinite(s)) delayMin = Math.round((a - s) / 60000)
  }

  const hasActual = !!(raw.takeoffActual || raw.landingActual || raw.gateDepActual || raw.gateArrActual)
  const flown = hasActual || raw.date <= today

  const airlineName = lookupAirline(raw.airlineCode) ?? (raw.airlineCode || 'Unknown airline')

  // Absolute instants: resolve local wall-clock against the endpoint's IANA tz.
  // Source preference mirrors depHourLocal/arrHourLocal. Null when no usable string or no tz.
  const depUtcMs = from
    ? localToUtcMs(raw.takeoffActual || raw.gateDepActual || raw.takeoffSched || raw.gateDepSched, from.tz)
    : null
  const arrUtcMs = to
    ? localToUtcMs(raw.landingActual || raw.gateArrActual || raw.landingSched || raw.gateArrSched, to.tz)
    : null

  return {
    id: raw.flightyId || `row:${raw.rawIndex}`,
    rawIndex: raw.rawIndex,
    date: raw.date,
    year: Number(raw.date.slice(0, 4)) || 0,
    airlineCode: raw.airlineCode,
    airlineName,
    flightNumber: raw.flightNumber,
    fromCode,
    toCode,
    intendedToCode,
    from,
    to,
    resolved,
    distanceMi,
    durationMin,
    durationSource,
    delayMin,
    depHourLocal: hourOf(raw.takeoffActual || raw.gateDepActual || raw.takeoffSched || raw.gateDepSched),
    arrHourLocal: hourOf(raw.landingActual || raw.gateArrActual || raw.landingSched || raw.gateArrSched),
    depUtcMs,
    arrUtcMs,
    canceled: raw.canceled,
    diverted,
    flown,
    isLocalFlight,
    excluded: ov?.exclude === true,
    aircraftType: raw.aircraftType.trim(),
    aircraftClass: classifyAircraft(raw.aircraftType.trim()),
    tail: raw.tail,
    seat: raw.seat,
    cabin: raw.cabin,
    pnr: raw.pnr,
    notes: raw.notes,
  }
}
