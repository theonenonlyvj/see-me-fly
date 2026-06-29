import CardFrame from '../components/CardFrame'
import BarList from '../components/charts/BarList'
import type { BarRow } from '../components/charts/BarList'
import { flagEmoji } from '../lib/format'
import { groups, lookupAirport } from '../../engine/reference'
import { homeKeys, hasHome } from '../../engine/home'
import { displayEndpoint } from '../lib/places'
import { flightsByAirportKey } from '../lib/flight-filters'
import type { Settings } from '../../engine'
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

export const airportsCard: CardDef = {
  id: 'airports',
  title: 'Most-visited airports',
  group: 'core',
  accent: ACCENT,
  icon: '📍',
  render: ({ model, settings, overlay }: CardContext) => {
    // Home exclusion now happens DATE-AWARE inside `byAirport`, so `model.byAirport` already omits
    // each home airport for the years it was home — no card-level post-filter. The "Home base" pill
    // still surfaces the (most-recent) home: its display key comes from `homeKeys`, and its count is
    // taken from the scoped flights directly (the home airport is no longer in `byAirport` when
    // excluded). Pill shows only when exclusion is on AND a home exists.
    const excludeOn = settings.excludeHomeFromRankings && hasHome(settings)
    const homeKey = excludeOn ? homeKeys(settings).primaryKey : null
    const homeFlights = homeKey ? flightsByAirportKey(model!.scoped, homeKey, settings) : []
    const homeEntry = homeKey && homeFlights.length > 0 ? { key: homeKey, count: homeFlights.length } : undefined
    const eraSummary = excludeOn ? homeEraSummary(settings) : ''
    const rows: BarRow[] = model!.byAirport.map((a) => ({ label: `${flagFor(a.key)} ${displayEndpoint(a.key)}`.trim(), value: a.count, id: a.key }))

    return (
      <CardFrame title="Most-visited airports" eyebrow="Where you land" accent={ACCENT} accentGrad={ACCENT_GRAD} accentSoft={ACCENT_SOFT} icon="📍"
        onTitleClick={() => overlay?.openFlights('Most-visited airports', model!.scoped)}>
        {homeEntry && (
          <div
            onClick={() => overlay?.openFlights(`Flights via ${displayEndpoint(homeEntry.key)}`, flightsByAirportKey(model!.scoped, homeEntry.key, settings))}
            role={overlay ? 'button' : undefined}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
              background: ACCENT_SOFT, border: `1px solid color-mix(in srgb, ${ACCENT} 28%, transparent)`,
              borderRadius: 12, padding: '8px 12px', marginBottom: 16, cursor: overlay ? 'pointer' : undefined,
            }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
              <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: ACCENT, marginRight: 8 }}>Home base</span>
              {flagFor(homeEntry.key)} {displayEndpoint(homeEntry.key)}
            </span>
            <span style={{ fontWeight: 800, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{homeEntry.count}</span>
          </div>
        )}
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
