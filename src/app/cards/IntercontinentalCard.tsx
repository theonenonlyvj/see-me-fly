import CardFrame from '../components/CardFrame'
import BarList from '../components/charts/BarList'
import type { BarRow } from '../components/charts/BarList'
import { intercontinentalByPair } from '../../engine/stats'
import { displayRouteString } from '../lib/places'
import { flightsByContinentPair } from '../lib/flight-filters'
import type { CardContext, CardDef } from './registry'

const ACCENT      = '#6a3cff'
const ACCENT_GRAD = 'linear-gradient(90deg, #6a3cff, #9a6bff)'
const ACCENT_SOFT = '#ebe4ff'

export const intercontinentalCard: CardDef = {
  id: 'intercontinental',
  title: 'Intercontinental',
  group: 'core',
  accent: ACCENT,
  icon: '🌐',
  render: (ctx: CardContext) => {
    const groups = intercontinentalByPair(ctx.model!.scoped, ctx.settings)
    const rows: BarRow[] = groups.map((g) => ({
      label: g.label,
      value: g.count,
      sub: `(${g.routes.length} route${g.routes.length === 1 ? '' : 's'})`,
      subRows: g.routes.map((r) => ({ label: displayRouteString(r.key, ctx.settings), value: r.count })),
      id: g.pair,
    }))
    return (
      <CardFrame
        title="Intercontinental"
        eyebrow="Crossing continents"
        accent={ACCENT}
        accentGrad={ACCENT_GRAD}
        accentSoft={ACCENT_SOFT}
        icon="🌐"
      >
        <BarList
          rows={rows}
          max={10}
          formatValue={(n) => `${n}`}
          accent={ACCENT}
          accentGrad={ACCENT_GRAD}
          accentSoft={ACCENT_SOFT}
          onRowClick={(row) => row.id && ctx.overlay?.openFlights(`Flights · ${row.label}`, flightsByContinentPair(ctx.model!.scoped, row.id))}
        />
      </CardFrame>
    )
  },
}
