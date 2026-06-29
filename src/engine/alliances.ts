import type { EnrichedFlight } from './types'
import { effectiveAirline } from './airline-history'

export type Alliance = 'star' | 'oneworld' | 'skyteam'
export type AllianceKey = Alliance | 'none'

export const ALLIANCE_LABEL: Record<AllianceKey, string> = {
  star: 'Star Alliance', oneworld: 'Oneworld', skyteam: 'SkyTeam', none: 'Unaligned',
}

/**
 * Airline ICAO → its alliance AS OF TODAY (~2026). Only CURRENT carriers are listed; defunct carriers
 * resolve through their merger successor (US Airways→American→Oneworld, Continental→United→Star,
 * Virgin America→Alaska→Oneworld, Northwest→Delta→SkyTeam) via effectiveAirline below. Anything not
 * listed (and every low-cost/independent carrier) is "Unaligned". Notable recent moves reflected:
 * SAS → SkyTeam (2024), Virgin Atlantic → SkyTeam (2023), Alaska → Oneworld (2021),
 * LATAM (ex-LAN) → Unaligned (left Oneworld 2020), China Southern → Unaligned (left 2019).
 */
export const AIRLINE_ALLIANCE: Record<string, Alliance> = {
  // Star Alliance
  UAL: 'star', DLH: 'star', ACA: 'star', ANA: 'star', SIA: 'star', THY: 'star', SWR: 'star', AUA: 'star',
  BEL: 'star', TAP: 'star', AEE: 'star', AIC: 'star', AVA: 'star', CMP: 'star', AAR: 'star', THA: 'star',
  CCA: 'star', ANZ: 'star', ETH: 'star', EVA: 'star',
  // Oneworld
  AAL: 'oneworld', BAW: 'oneworld', QTR: 'oneworld', CPA: 'oneworld', IBE: 'oneworld', FIN: 'oneworld',
  JAL: 'oneworld', MAS: 'oneworld', QFA: 'oneworld', ALK: 'oneworld', ASA: 'oneworld', RJA: 'oneworld',
  // SkyTeam
  DAL: 'skyteam', AFR: 'skyteam', KLM: 'skyteam', AMX: 'skyteam', KAL: 'skyteam', CES: 'skyteam', SVA: 'skyteam',
  GIA: 'skyteam', VIR: 'skyteam', SAS: 'skyteam', AFL: 'skyteam', ITY: 'skyteam', CXA: 'skyteam', MSR: 'skyteam',
}

/** Today's alliance for a flight's airline; defunct carriers resolve to their successor's alliance. */
export function allianceForFlight(f: EnrichedFlight): AllianceKey {
  const code = effectiveAirline(f, true).code
  return AIRLINE_ALLIANCE[code] ?? 'none'
}

/** Flight counts per alliance (+ Unaligned), in fixed display order; empty buckets dropped. */
export function byAlliance(flights: EnrichedFlight[]): { alliance: AllianceKey; count: number }[] {
  const counts: Record<AllianceKey, number> = { star: 0, oneworld: 0, skyteam: 0, none: 0 }
  for (const f of flights) {
    if (!f.airlineCode || f.airlineName === 'Unknown airline') continue // no identifiable airline → skip, don't mislabel as unaligned
    counts[allianceForFlight(f)] += 1
  }
  const order: AllianceKey[] = ['star', 'oneworld', 'skyteam', 'none']
  return order.map((a) => ({ alliance: a, count: counts[a] })).filter((x) => x.count > 0)
}
