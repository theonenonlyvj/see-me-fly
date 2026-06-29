import type { EnrichedFlight } from './types'
import { lookupAirline } from './reference'

/** Defunct / merged carriers (ICAO → fate text). Curated; covers the long-tail carriers in real data. */
export const DEFUNCT_AIRLINES: Record<string, string> = {
  AWE: 'merged into American, 2015',
  COA: 'merged into United, 2012',
  TRS: 'merged into Southwest, 2014',
  VRD: 'merged into Alaska, 2018',
  JAI: 'ceased operations, 2019',
  KFR: 'ceased operations, 2012',
  JLL: 'folded into Jet Airways, 2012',
  NWA: 'merged into Delta, 2010',
  AAH: 'merged into US Airways, 2005',
}

/** Defunct carrier ICAO → SURVIVING carrier ICAO (mergers only; ceased airlines are absent). */
export const DEFUNCT_SUCCESSOR: Record<string, string> = {
  AWE: 'AAL', // US Airways → American
  COA: 'UAL', // Continental → United
  TRS: 'SWA', // AirTran → Southwest
  VRD: 'ASA', // Virgin America → Alaska
  NWA: 'DAL', // Northwest → Delta
  AAH: 'AWE', // America West → US Airways (→ American; resolved transitively below)
}

/**
 * A flight's effective airline. When `merge` is on, a defunct carrier that was ACQUIRED is rolled
 * into its surviving carrier (US Airways → American), following the chain (America West → US Airways
 * → American). Carriers that merely ceased (Jet Airways, Kingfisher) have no successor and stay put.
 */
export function effectiveAirline(f: EnrichedFlight, merge: boolean): { code: string; name: string } {
  if (!merge) return { code: f.airlineCode, name: f.airlineName }
  let code = f.airlineCode
  for (let i = 0; i < 4 && DEFUNCT_SUCCESSOR[code]; i++) code = DEFUNCT_SUCCESSOR[code]
  if (code === f.airlineCode) return { code: f.airlineCode, name: f.airlineName }
  return { code, name: lookupAirline(code) ?? f.airlineName }
}
