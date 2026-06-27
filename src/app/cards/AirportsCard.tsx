import CardFrame from '../components/CardFrame'
import BarList from '../components/charts/BarList'
import type { BarRow } from '../components/charts/BarList'
import { flagEmoji } from '../lib/format'
import { groups, lookupAirport } from '../../engine/reference'
import { displayEndpoint } from '../lib/places'
import { flightsByAirportKey } from '../lib/flight-filters'
import type { CardContext, CardDef } from './registry'

const ACCENT      = '#12c08a'
const ACCENT_GRAD = 'linear-gradient(90deg, #12c08a, #3ad6c0)'
const ACCENT_SOFT = '#ddf7ee'

// group name -> member airport codes
const groupByName = new Map<string, string[]>()
for (const g of groups) groupByName.set(g.name, g.airports)

function flagFor(key: string): string {
  const members = groupByName.get(key)
  const ap = members ? members.map((c) => lookupAirport(c)).find(Boolean) : lookupAirport(key)
  return ap?.country ? flagEmoji(ap.country) : ''
}

function buildRows(model: NonNullable<CardContext['model']>): BarRow[] {
  return model.byAirport.map((a) => ({
    // displayEndpoint always shows the code: "Austin (AUS)" or "Dallas (DFW/DAL)"
    label: `${flagFor(a.key)} ${displayEndpoint(a.key)}`.trim(),
    value: a.count,
    id: a.key,
  }))
}

export const airportsCard: CardDef = {
  id: 'airports',
  title: 'Most-visited airports',
  group: 'core',
  accent: ACCENT,
  icon: '📍',
  render: ({ model, settings, overlay }: CardContext) => {
    const rows = buildRows(model!)
    return (
      <CardFrame title="Most-visited airports" eyebrow="Where you land" accent={ACCENT} accentGrad={ACCENT_GRAD} accentSoft={ACCENT_SOFT} icon="📍">
        <BarList rows={rows} max={10} formatValue={(n) => `${n}`} accent={ACCENT} accentGrad={ACCENT_GRAD} accentSoft={ACCENT_SOFT}
          onRowClick={(row) => row.id && overlay?.openFlights(`Flights via ${row.label}`, flightsByAirportKey(model!.scoped, row.id, settings))} />
      </CardFrame>
    )
  },
}
