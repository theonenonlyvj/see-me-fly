import CardFrame from '../components/CardFrame'
import BarList from '../components/charts/BarList'
import type { BarRow } from '../components/charts/BarList'
import { flagEmoji } from '../lib/format'
import { groups, lookupAirport } from '../../engine/reference'
import { hasHome, homeAt, homePrimaryKeys, isHomeOn } from '../../engine/home'
import { airportKey } from '../../engine/normalize'
import { displayEndpoint } from '../lib/places'
import { flightsByAirportKey } from '../lib/flight-filters'
import type { EnrichedFlight, Settings } from '../../engine'
import type { CardContext, CardDef } from './registry'

const ACCENT      = '#12c08a'
const ACCENT_GRAD = 'linear-gradient(90deg, #12c08a, #3ad6c0)'
const ACCENT_SOFT = '#ddf7ee'

const groupByName = new Map<string, string[]>()
for (const g of groups) groupByName.set(g.name, g.airports)

function flagFor(key: string): string {
  const members = groupByName.get(key)
  const ap = members ? members.map((c) => lookupAirport(c)).find(Boolean) : lookupAirport(key)
  return ap?.country ? flagEmoji(ap.country) : ''
}

/**
 * One line per home era for the exclusion pill's hover title:
 * "RDU — 2008-08-18 to 2013-01-15 (College)", the last era open-ended ("to present").
 * Falls back to the legacy single `home` when there's no timeline.
 */
function homeEraSummary(settings: Settings): string {
  const eras = [...settings.homeHistory].sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0))
  if (eras.length === 0) {
    return settings.home ? `${settings.home} — all dates` : ''
  }
  return eras
    .map((era, i) => {
      const end = i + 1 < eras.length ? eras[i + 1].start : 'present'
      const codes = era.airports.join('/')
      const label = era.label ? ` (${era.label})` : ''
      return `${codes} — ${era.start} to ${end}${label}`
    })
    .join('\n')
}

/**
 * DATE-AWARE, per-base "Home base" pills. Mirrors `byAirport`'s exclusion EXACTLY: it walks the
 * same endpoint occurrences (`[fromCode]` for a local flight, else `[fromCode, toCode]`) and keeps
 * ONLY the ones `byAirport` dropped — i.e. those where `isHomeOn(code, f.date, settings)` is true —
 * bucketing each by the home base that was actually home on that flight's date (the metro key of
 * `homeAt(f.date).primary`). Because the pills count exactly the occurrences `byAirport` excluded,
 * the pill totals and the ranked bars PARTITION the scoped endpoint occurrences with zero overlap:
 * a 2012 DFW flight (DFW not yet home in 2012) stays a ranked bar, while a 2012 MKE endpoint (MKE
 * home in 2012) is dropped from the bars and shows under the Milwaukee pill. `flights` is the set of
 * scoped flights touching that base on a home date (deduped) for click-through.
 */
interface HomePill { key: string; count: number; flights: EnrichedFlight[] }
function homePills(scoped: EnrichedFlight[], settings: Settings): HomePill[] {
  const byBase = new Map<string, { count: number; flights: EnrichedFlight[] }>()
  for (const f of scoped) {
    if (!f.resolved) continue
    const codes = f.isLocalFlight ? [f.fromCode] : [f.fromCode, f.toCode]
    let touchedBase: string | null = null
    for (const code of codes) {
      if (!isHomeOn(code, f.date, settings)) continue // only the endpoints byAirport drops
      const resolved = homeAt(f.date, settings)
      // The home base this date resolves to, in the current token space (metro key when grouping).
      const baseKey = resolved ? airportKey(resolved.primary, settings.groupAirports) : airportKey(code, settings.groupAirports)
      const cur = byBase.get(baseKey) ?? { count: 0, flights: [] }
      cur.count += 1 // one per excluded endpoint occurrence — partitions with byAirport's counts
      byBase.set(baseKey, cur)
      touchedBase = baseKey
    }
    // Record the flight once on the base it touched (for the click-through list — deduped per flight).
    if (touchedBase) byBase.get(touchedBase)!.flights.push(f)
  }
  return [...byBase]
    .map(([key, v]) => ({ key, count: v.count, flights: v.flights }))
    .sort((a, b) => b.count - a.count)
}

export const airportsCard: CardDef = {
  id: 'airports',
  title: 'Most-visited airports',
  group: 'core',
  accent: ACCENT,
  icon: '📍',
  render: ({ model, settings, overlay }: CardContext) => {
    // Home exclusion happens DATE-AWARE inside `byAirport`, so `model.byAirport` already omits each
    // home airport for the years it was home — no card-level post-filter. The "Home base" pills
    // surface those excluded endpoints, DATE-AWARE and per-era (see `homePills`): under a prior-year
    // scope the pill names that era's home, and there is ONE pill per distinct excluded home base.
    // Pills show only when exclusion is on AND a home exists.
    const excludeOn = settings.excludeHomeFromRankings && hasHome(settings)
    const pills = excludeOn ? homePills(model!.scoped, settings) : []
    const eraSummary = excludeOn ? homeEraSummary(settings) : ''
    const rows: BarRow[] = model!.byAirport.map((a) => ({ label: `${flagFor(a.key)} ${displayEndpoint(a.key)}`.trim(), value: a.count, id: a.key }))

    return (
      <CardFrame title="Most-visited airports" eyebrow="Where you land" accent={ACCENT} accentGrad={ACCENT_GRAD} accentSoft={ACCENT_SOFT} icon="📍"
        onTitleClick={() => overlay?.openFlights('Most-visited airports', model!.scoped)}>
        {/* One pill per excluded home base would swarm across 15 eras under an all-time scope. So:
            a single base (one era — typical under a YEAR scope) keeps the full pill; multiple bases
            collapse into ONE cohesive "Home bases" row — the current base prominent, earlier homes
            listed compactly, with the combined excluded-flight count. The per-base flight lists are
            merged (deduped) for the click-through. */}
        {pills.length === 1 && (() => {
          const pill = pills[0]
          return (
            <div
              key={pill.key}
              onClick={() => overlay?.openFlights(`Flights via ${displayEndpoint(pill.key)}`, pill.flights)}
              role={overlay ? 'button' : undefined}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
                background: ACCENT_SOFT, border: `1px solid color-mix(in srgb, ${ACCENT} 28%, transparent)`,
                borderRadius: 12, padding: '8px 12px', marginBottom: 16, cursor: overlay ? 'pointer' : undefined,
              }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
                <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: ACCENT, marginRight: 8 }}>Home base</span>
                {flagFor(pill.key)} {displayEndpoint(pill.key)}
              </span>
              <span style={{ fontWeight: 800, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{pill.count}</span>
            </div>
          )
        })()}
        {pills.length > 1 && (() => {
          // pills[0] is the busiest base; `currentKey` is the most-recent home so it leads as "current".
          const currentKey = homePrimaryKeys(settings).currentKey
          const current = pills.find((p) => p.key === currentKey) ?? pills[0]
          const earlier = pills.filter((p) => p !== current)
          const totalCount = pills.reduce((s, p) => s + p.count, 0)
          const allFlights = [...new Set(pills.flatMap((p) => p.flights))]
          return (
            <div
              onClick={() => overlay?.openFlights('Flights via your home bases', allFlights)}
              role={overlay ? 'button' : undefined}
              style={{
                background: ACCENT_SOFT, border: `1px solid color-mix(in srgb, ${ACCENT} 28%, transparent)`,
                borderRadius: 12, padding: '10px 12px', marginBottom: 16, cursor: overlay ? 'pointer' : undefined,
              }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
                  <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: ACCENT, marginRight: 8 }}>Home bases</span>
                  {flagFor(current.key)} {displayEndpoint(current.key)}
                </span>
                <span style={{ fontWeight: 800, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{totalCount}</span>
              </div>
              {earlier.length > 0 && (
                <div style={{ fontSize: 11.5, color: 'var(--ink-2)', fontWeight: 600, display: 'flex', flexWrap: 'wrap', gap: '2px 6px' }}>
                  <span style={{ fontWeight: 700 }}>+ earlier:</span>
                  {earlier.map((p, i) => (
                    <span key={p.key}>{displayEndpoint(p.key)}{i < earlier.length - 1 ? ' ·' : ''}</span>
                  ))}
                </div>
              )}
            </div>
          )
        })()}
        <BarList rows={rows} max={5} seeAllTitle="Most-visited airports" formatValue={(n) => `${n}`} accent={ACCENT} accentGrad={ACCENT_GRAD} accentSoft={ACCENT_SOFT}
          onRowClick={(row) => row.id && overlay?.openFlights(`Flights via ${row.label}`, flightsByAirportKey(model!.scoped, row.id, settings))} />
        {excludeOn && (
          <p data-home-eras title={eraSummary || undefined}
            style={{ marginTop: 12, fontSize: 11.5, color: 'var(--ink-2)', fontStyle: 'italic', cursor: eraSummary ? 'help' : undefined }}>
            Home airports excluded for the years each was home — toggle in Settings.
          </p>
        )}
      </CardFrame>
    )
  },
}
