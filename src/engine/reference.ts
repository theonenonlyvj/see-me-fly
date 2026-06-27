import type { Airport, AircraftClass, Continent } from './types'
import airportsRaw from '../reference/airports.json'
import airlinesRaw from '../reference/airlines.json'
import airlineOverrides from '../reference/airline-overrides.json'
import regionsRaw from '../reference/regions.json'
import groupsRaw from '../reference/airport-groups.json'
import classesRaw from '../reference/aircraft-classes.json'

const records = airportsRaw as Airport[]

export const airportIndex = new Map<string, Airport>()
for (const a of records) {
  const keys = [a.iata, a.localCode, a.ident, a.ident.replace(/^[KC]/, '')]
  for (const k of keys) {
    if (!k) continue
    const key = k.toUpperCase()
    if (!airportIndex.has(key)) airportIndex.set(key, a) // first-wins for non-IATA keys; IATA precedence enforced by the second pass below
  }
}
// Ensure IATA takes precedence: re-insert IATA keys last-wins by overwriting.
for (const a of records) if (a.iata) airportIndex.set(a.iata.toUpperCase(), a)

export function lookupAirport(code: string): Airport | null {
  if (!code) return null
  return airportIndex.get(code.trim().toUpperCase()) ?? null
}

const airlineMap: Record<string, string> = {
  ...(airlinesRaw as Record<string, string>),
  ...(airlineOverrides as Record<string, string>),
}
export function lookupAirline(icao: string): string | null {
  if (!icao) return null
  return airlineMap[icao.trim().toUpperCase()] ?? null
}

const { regions, countries } = regionsRaw as { regions: Record<string, string>; countries: Record<string, string> }
export function regionName(code: string): string { return regions[code] ?? code }
export function countryName(code: string): string { return countries[code] ?? code }

export const groups = groupsRaw as { name: string; airports: string[] }[]
export const airportToGroup = new Map<string, string>()
for (const g of groups) for (const code of g.airports) airportToGroup.set(code.toUpperCase(), g.name)

const classRules = classesRaw as { pattern: string; class: AircraftClass }[]
export function classifyAircraft(typeName: string): AircraftClass {
  if (!typeName) return 'unclassified'
  const lower = typeName.toLowerCase()
  for (const r of classRules) if (lower.includes(r.pattern.toLowerCase())) return r.class
  return 'unclassified'
}

/**
 * Collapse "close enough" aircraft sub-variants of the SAME base model into one family:
 *   Boeing 737-700 / 737-800 / 737 MAX 8  -> "Boeing 737"   (777 variants -> "Boeing 777", kept SEPARATE)
 *   Airbus A320 / A320neo                  -> "Airbus A320"  (A319 / A321 kept separate)
 *   Airbus A330-300 / A330-200             -> "Airbus A330"
 * Different model NUMBERS stay distinct. Other manufacturers are returned unchanged.
 */
export function aircraftFamily(typeName: string): string {
  if (!typeName) return typeName
  const boeing = typeName.match(/^(Boeing 7\d7)\b/)
  if (boeing) return boeing[1]
  const airbus = typeName.match(/^(Airbus A\d{3})/)
  if (airbus) return airbus[1]
  return typeName
}

export type { Continent }
