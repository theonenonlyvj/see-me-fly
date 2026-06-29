import type { EnrichedFlight, GroundLink } from './types'

/**
 * A unified, chronologically-orderable movement: either a flown leg or a recorded
 * ground segment (drive/bus/train/ferry). Trip reconstruction iterates this stream so a
 * ground link can BRIDGE across (or CLOSE) a trip gap that flights alone leave open.
 * Only `kind: 'flight'` movements contribute to a trip's flight list / stats — links
 * are bridges only (Phase A).
 */
export type Movement =
  | { kind: 'flight'; sortMs: number; date: string; fromCode: string; toCode: string; flight: EnrichedFlight }
  | { kind: 'link'; sortMs: number; date: string; fromCode: string; toCode: string; link: GroundLink }

/** Mirror of the flight sort instant used elsewhere (`stats.ts`): absolute departure UTC ms, else date. */
function flightSortMs(f: EnrichedFlight): number {
  if (f.depUtcMs != null) return f.depUtcMs
  const t = Date.parse(f.date)
  return Number.isFinite(t) ? t : 0
}

/**
 * A link's sort instant: midnight (UTC) of its departure `date`, plus `departTime` (HH:mm)
 * when present. Links lacking a precise time sort at start-of-day, which (via the tiebreak
 * below) places them AFTER a same-day flight — so a same-day "land then drive" reads as a
 * connection's redeparture, not as preceding the flight that arrived.
 */
function linkSortMs(l: GroundLink): number {
  const base = Date.parse(`${l.date}T00:00:00Z`)
  const day = Number.isFinite(base) ? base : 0
  if (l.departTime) {
    const m = /^(\d{1,2}):(\d{2})/.exec(l.departTime)
    if (m) return day + (Number(m[1]) * 60 + Number(m[2])) * 60_000
  }
  return day
}

/**
 * Merge flights + ground links into one chronologically-sorted Movement stream.
 * Deterministic tiebreak for equal `sortMs`: flights before links, then by original index
 * (`rawIndex` for flights, the link's array position for links). This matches how
 * `reconstructTrips` / `commonLayovers` already tiebreak same-instant flights by `rawIndex`.
 */
export function buildMovements(flights: EnrichedFlight[], links: GroundLink[]): Movement[] {
  const items: Array<Movement & { tieKind: number; tieIdx: number }> = []
  for (const f of flights) {
    items.push({
      kind: 'flight', sortMs: flightSortMs(f), date: f.date, fromCode: f.fromCode, toCode: f.toCode, flight: f,
      tieKind: 0, tieIdx: f.rawIndex,
    })
  }
  links.forEach((l, i) => {
    items.push({
      kind: 'link', sortMs: linkSortMs(l), date: l.date, fromCode: l.fromAirport, toCode: l.toAirport, link: l,
      tieKind: 1, tieIdx: i,
    })
  })
  items.sort((a, b) => a.sortMs - b.sortMs || a.tieKind - b.tieKind || a.tieIdx - b.tieIdx)
  // Strip the sort-only fields back to the public Movement shape.
  return items.map(({ tieKind: _tk, tieIdx: _ti, ...m }) => m as Movement)
}
