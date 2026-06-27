import CardFrame from '../components/CardFrame'
import BarList from '../components/charts/BarList'
import type { BarRow } from '../components/charts/BarList'
import { flagEmoji } from '../lib/format'
import { groups, lookupAirport } from '../../engine/reference'
import { airportKey } from '../../engine/normalize'
import { displayEndpoint } from '../lib/places'
import { flightsByAirportKey } from '../lib/flight-filters'
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

export const airportsCard: CardDef = {
  id: 'airports',
  title: 'Most-visited airports',
  group: 'core',
  accent: ACCENT,
  icon: '📍',
  render: ({ model, settings, overlay }: CardContext) => {
    const homeMetro = settings.excludeHomeFromRankings && settings.home
      ? airportKey(settings.home, settings.groupAirports) : null
    const homeEntry = homeMetro ? model!.byAirport.find((a) => a.key === homeMetro) : undefined
    const ranked = homeEntry ? model!.byAirport.filter((a) => a.key !== homeMetro) : model!.byAirport
    const rows: BarRow[] = ranked.map((a) => ({ label: `${flagFor(a.key)} ${displayEndpoint(a.key)}`.trim(), value: a.count, id: a.key }))

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
      </CardFrame>
    )
  },
}
