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

export interface AirlineGroup {
  key: string                 // alliance key, an effective airline name, or 'other-unaligned'
  label: string
  count: number
  kind: 'alliance' | 'airline' | 'other'
  alliance?: AllianceKey      // present when kind === 'alliance'
  code?: string               // representative ICAO, present when kind === 'airline' (for its logo)
}

/** Airlines you flew within a given alliance, by effective/successor name, sorted by count desc. */
export function airlinesInAlliance(flights: EnrichedFlight[], alliance: Alliance): { name: string; code: string; count: number }[] {
  const m = new Map<string, { count: number; code: string }>()
  for (const f of flights) {
    if (!f.airlineCode || f.airlineName === 'Unknown airline') continue
    const eff = effectiveAirline(f, true)
    if (((AIRLINE_ALLIANCE[eff.code] as Alliance | undefined) ?? 'none') !== alliance) continue
    const cur = m.get(eff.name) ?? { count: 0, code: eff.code }
    cur.count += 1
    m.set(eff.name, cur)
  }
  return [...m.entries()].map(([name, v]) => ({ name, code: v.code, count: v.count })).sort((a, b) => b.count - a.count)
}

/**
 * Alliance breakdown that PROMOTES any big unaligned carrier to its own slice instead of burying it
 * in "Unaligned" (Southwest is ~a third of Vijay's flying). The 3 alliances stay aggregated; an
 * unaligned airline (by its effective/successor name, so AirTran rolls into Southwest) gets its own
 * group when it's >= 20% of the unaligned total (and >= 5 flights); the rest become "Other (unaligned)".
 * Returned sorted by count desc.
 */
export function airlineGroups(flights: EnrichedFlight[]): AirlineGroup[] {
  const allianceCounts: Record<Alliance, number> = { star: 0, oneworld: 0, skyteam: 0 }
  const unaligned = new Map<string, { count: number; code: string }>() // effective airline name → {count, code}
  for (const f of flights) {
    if (!f.airlineCode || f.airlineName === 'Unknown airline') continue
    const eff = effectiveAirline(f, true)
    const a: AllianceKey = (AIRLINE_ALLIANCE[eff.code] as Alliance | undefined) ?? 'none'
    if (a === 'none') { const c = unaligned.get(eff.name) ?? { count: 0, code: eff.code }; c.count += 1; unaligned.set(eff.name, c) }
    else allianceCounts[a] += 1
  }
  const unalignedTotal = [...unaligned.values()].reduce((s, x) => s + x.count, 0)
  const threshold = Math.max(unalignedTotal * 0.2, 5)

  const groups: AirlineGroup[] = []
  for (const a of ['star', 'oneworld', 'skyteam'] as Alliance[]) {
    if (allianceCounts[a] > 0) groups.push({ key: a, label: ALLIANCE_LABEL[a], count: allianceCounts[a], kind: 'alliance', alliance: a })
  }
  let otherCount = 0
  for (const [name, v] of [...unaligned.entries()].sort((x, y) => y[1].count - x[1].count)) {
    if (v.count >= threshold) groups.push({ key: name, label: name, count: v.count, kind: 'airline', code: v.code })
    else otherCount += v.count
  }
  if (otherCount > 0) groups.push({ key: 'other-unaligned', label: 'Other (unaligned)', count: otherCount, kind: 'other' })
  return groups.sort((a, b) => b.count - a.count)
}
