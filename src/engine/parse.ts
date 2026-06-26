import Papa from 'papaparse'
import type { RawFlight } from './types'

export const REQUIRED_COLUMNS = [
  'Date', 'Airline', 'Flight', 'From', 'To', 'Dep Terminal', 'Dep Gate', 'Arr Terminal', 'Arr Gate',
  'Canceled', 'Diverted To', 'Gate Departure (Scheduled)', 'Gate Departure (Actual)',
  'Take off (Scheduled)', 'Take off (Actual)', 'Landing (Scheduled)', 'Landing (Actual)',
  'Gate Arrival (Scheduled)', 'Gate Arrival (Actual)', 'Aircraft Type Name', 'Tail Number',
  'PNR', 'Seat', 'Seat Type', 'Cabin Class', 'Flight Reason', 'Notes', 'Flight Flighty ID',
  'Airline Flighty ID', 'Departure Airport Flighty ID', 'Arrival Airport Flighty ID',
  'Diverted To Airport Flighty ID', 'Aircraft Type Flighty ID',
]

const g = (r: Record<string, string>, k: string) => (r[k] ?? '').trim()

export function parseFlightyCsv(text: string): { rows: RawFlight[]; headerOk: boolean; missingColumns: string[] } {
  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true, worker: false })
  const fields = parsed.meta.fields ?? []
  const missingColumns = ['Date', 'Airline', 'Flight', 'From', 'To', 'Canceled'].filter((c) => !fields.includes(c))
  const headerOk = missingColumns.length === 0
  const rows: RawFlight[] = parsed.data.map((r, i) => ({
    rawIndex: i,
    date: g(r, 'Date'),
    airlineCode: g(r, 'Airline'),
    flightNumber: g(r, 'Flight'),
    fromCode: g(r, 'From'),
    toCode: g(r, 'To'),
    canceled: g(r, 'Canceled').toLowerCase() === 'true',
    divertedToCode: g(r, 'Diverted To'),
    gateDepSched: g(r, 'Gate Departure (Scheduled)'),
    gateDepActual: g(r, 'Gate Departure (Actual)'),
    takeoffSched: g(r, 'Take off (Scheduled)'),
    takeoffActual: g(r, 'Take off (Actual)'),
    landingSched: g(r, 'Landing (Scheduled)'),
    landingActual: g(r, 'Landing (Actual)'),
    gateArrSched: g(r, 'Gate Arrival (Scheduled)'),
    gateArrActual: g(r, 'Gate Arrival (Actual)'),
    aircraftType: g(r, 'Aircraft Type Name'),
    tail: g(r, 'Tail Number'),
    pnr: g(r, 'PNR'),
    seat: g(r, 'Seat'),
    cabin: g(r, 'Cabin Class'),
    reason: g(r, 'Flight Reason'),
    notes: g(r, 'Notes'),
    flightyId: g(r, 'Flight Flighty ID'),
  }))
  return { rows, headerOk, missingColumns }
}
