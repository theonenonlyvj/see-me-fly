import { useState } from 'react'
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
import type { OverlayApi } from '../components/Overlay'
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
 * "CMH — 2008-08-18 to 2013-01-15 (College)", the last era open-ended ("to present").
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
 * Per-base home era date-range(s), keyed by the base's metro `airportKey` (so two eras that merge to
 * the same Dallas key combine their ranges). Each era runs from its `start` to the NEXT era's start
 * (or "present" for the last). Returns e.g. "2008–2013 (College) · 2013–present". Empty when there
 * is no timeline (legacy single `home`).
 */
function homeEraRanges(settings: Settings): Map<string, string> {
  const eras = [...settings.homeHistory].sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0))
  const byKey = new Map<string, string[]>()
  eras.forEach((era, i) => {
    const key = airportKey(era.airports[0], settings.groupAirports)
    const end = i + 1 < eras.length ? eras[i + 1].start.slice(0, 4) : 'present'
    // Just the year range — the freeform era labels/notes are too noisy in this list.
    const range = `${era.start.slice(0, 4)}–${end}`
    const cur = byKey.get(key) ?? []
    cur.push(range)
    byKey.set(key, cur)
  })
  return new Map([...byKey].map(([k, ranges]) => [k, ranges.join(' · ')]))
}

/**
 * DATE-AWARE, per-base "Home base" pills. Mirrors `byAirport`'s exclusion EXACTLY: it walks the
 * same endpoint occurrences (`[fromCode]` for a local flight, else `[fromCode, toCode]`) and keeps
 * ONLY the ones `byAirport` dropped — i.e. those where `isHomeOn(code, f.date, settings)` is true —
 * bucketing each by the home base that was actually home on that flight's date (the metro key of
 * `homeAt(f.date).primary`). Because the pills count exactly the occurrences `byAirport` excluded,
 * the pill totals and the ranked bars PARTITION the scoped endpoint occurrences with zero overlap:
 * a 2019 DFW flight (DFW not yet home in 2019) stays a ranked bar, while a 2019 DEN endpoint (DEN
 * home in 2019) is dropped from the bars and shows under the Denver pill. `flights` is the set of
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

/**
 * The multi-base "Home bases" chip. Compact header is kept (user likes it): the current base
 * prominent + a "+ earlier" line + the combined count. Clicking the header no longer collapses the
 * data into one merged flight list — it TOGGLES an inline list of EVERY home base (most-recent-first),
 * each row showing the base's metro label, its era date range(s), and its home-flight count. A row
 * click opens THAT base's home flights; a second header click collapses the list.
 */
function HomeBasesChip({ pills, settings, overlay }: { pills: HomePill[]; settings: Settings; overlay?: OverlayApi }) {
  const [open, setOpen] = useState(false)
  const { currentKey } = homePrimaryKeys(settings)
  const current = pills.find((p) => p.key === currentKey) ?? pills[0]
  const earlier = pills.filter((p) => p !== current)
  const totalCount = pills.reduce((s, p) => s + p.count, 0)
  const ranges = homeEraRanges(settings)

  // Most-recent-first: lead with the current base, then the rest in pill order (busiest first).
  const ordered = [current, ...earlier]

  return (
    <div
      style={{
        background: ACCENT_SOFT, border: `1px solid color-mix(in srgb, ${ACCENT} 28%, transparent)`,
        borderRadius: 12, padding: '10px 12px', marginBottom: 16,
      }}>
      <div
        onClick={() => setOpen((v) => !v)}
        role={overlay ? 'button' : undefined}
        aria-expanded={open}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, cursor: overlay ? 'pointer' : undefined }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
          <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: ACCENT, marginRight: 8 }}>Home bases</span>
          {flagFor(current.key)} {displayEndpoint(current.key)}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 800, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{totalCount}</span>
          <span style={{ fontSize: 11, color: ACCENT, transform: open ? 'rotate(180deg)' : undefined, transition: 'transform .15s ease' }}>▾</span>
        </span>
      </div>
      {!open && earlier.length > 0 && (
        <div style={{ fontSize: 11.5, color: 'var(--ink-2)', fontWeight: 600, display: 'flex', flexWrap: 'wrap', gap: '2px 6px', marginTop: 6 }}>
          <span style={{ fontWeight: 700 }}>+ earlier:</span>
          {earlier.map((p, i) => (
            <span key={p.key}>{displayEndpoint(p.key)}{i < earlier.length - 1 ? ' ·' : ''}</span>
          ))}
        </div>
      )}
      {open && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {ordered.map((p) => {
            const range = ranges.get(p.key)
            return (
              <div
                key={p.key}
                onClick={() => overlay?.openFlights(`Flights via ${displayEndpoint(p.key)}`, p.flights)}
                role={overlay ? 'button' : undefined}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
                  background: 'var(--surface)', border: `1px solid color-mix(in srgb, ${ACCENT} 20%, transparent)`,
                  borderRadius: 10, padding: '8px 10px', cursor: overlay ? 'pointer' : undefined,
                }}>
                <span style={{ minWidth: 0 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>
                    {flagFor(p.key)} {displayEndpoint(p.key)}
                    {p.key === current.key && (
                      <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: ACCENT, marginLeft: 6 }}>current</span>
                    )}
                  </span>
                  {range && (
                    <span style={{ display: 'block', fontSize: 11, color: 'var(--ink-2)', fontWeight: 500, marginTop: 1 }}>{range}</span>
                  )}
                </span>
                <span style={{ fontWeight: 800, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{p.count}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
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
        {pills.length > 1 && <HomeBasesChip pills={pills} settings={settings} overlay={overlay} />}
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
