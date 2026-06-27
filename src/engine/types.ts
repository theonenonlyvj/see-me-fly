export type Continent = 'NA' | 'SA' | 'EU' | 'AF' | 'AS' | 'OC' | 'AN'
export type AircraftClass = 'wide' | 'narrow' | 'regional' | 'prop' | 'unclassified'
export type DurationSource = 'actual' | 'scheduled' | 'gate' | 'estimate' | 'localDefault' | 'override'

export interface Airport {
  iata: string | null
  localCode: string | null
  ident: string
  name: string
  municipality: string
  lat: number
  lon: number
  country: string      // ISO country code, e.g. "US"
  region: string       // ISO region code, e.g. "US-TX"
  continent: Continent
  tz: string           // IANA, e.g. "America/Chicago"
}

/** One raw CSV row, all strings, blanks as "". Keys match Flighty headers. */
export interface RawFlight {
  rawIndex: number     // 0-based position in the file (stable tiebreak)
  date: string
  airlineCode: string
  flightNumber: string
  fromCode: string
  toCode: string
  canceled: boolean
  divertedToCode: string
  gateDepSched: string
  gateDepActual: string
  takeoffSched: string
  takeoffActual: string
  landingSched: string
  landingActual: string
  gateArrSched: string
  gateArrActual: string
  aircraftType: string
  tail: string
  pnr: string
  seat: string
  cabin: string
  reason: string
  notes: string
  flightyId: string    // may be ""
}

export interface DurationConstants {
  cruiseMph: number
  taxiMin: number
  climbDescentMin: number
  gateTaxiMin: number
  localFlightDefaultMin: number
  localFlightMinMin: number
}

export interface EnrichedFlight {
  id: string                 // stable: flightyId || `row:${rawIndex}`
  rawIndex: number
  date: string               // YYYY-MM-DD (departure date)
  year: number
  airlineCode: string
  airlineName: string        // resolved or raw code or "Unknown airline"
  flightNumber: string
  fromCode: string
  toCode: string             // EFFECTIVE destination (diverted-to if diverted)
  intendedToCode: string | null  // original scheduled To when diverted, else null
  from: Airport | null
  to: Airport | null         // effective destination airport
  resolved: boolean          // both endpoints resolved
  distanceMi: number | null
  durationMin: number | null
  durationSource: DurationSource | null
  delayMin: number | null
  depHourLocal: number | null  // 0-23 from raw local takeoff/gate-dep, no tz shift
  arrHourLocal: number | null
  depUtcMs: number | null      // absolute departure instant (UTC ms), tz-resolved; null if no usable time/tz
  arrUtcMs: number | null      // absolute arrival instant (UTC ms), tz-resolved; null if no usable time/tz
  canceled: boolean
  diverted: boolean
  flown: boolean
  isLocalFlight: boolean     // From == To after resolution (legitimate local flight)
  excluded: boolean          // dropped by an override
  aircraftType: string
  aircraftClass: AircraftClass
  tail: string
  seat: string
  cabin: string
  pnr: string
  notes: string
}

export interface Settings {
  groupAirports: boolean
  explicitlyUnique: boolean
  includeCanceled: boolean
  excludeBeforeDate: string | null  // "YYYY-MM-DD" or null
  home: string | null               // home airport CODE (e.g. "DFW"); compared via airportKey() so it matches grouped/ungrouped tokens
  excludeHomeFromRankings: boolean   // when true, home is a pill (not ranked) in Airports, and the home endpoint isn't credited in Countries
  layoverMaxHours: number           // a connection counts as a layover when the gap is <= this many hours
  excludeDayTrips: boolean          // when true, a turnaround (land at X then fly back to where you came from) is NOT a layover
  splitCountriesByState: string[]   // country codes (subset of US/MX/IN) whose states rank inline as their own rows
  duration: DurationConstants
}
