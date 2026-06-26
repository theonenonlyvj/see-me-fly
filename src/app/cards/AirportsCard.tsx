import CardFrame from '../components/CardFrame'
import BarList from '../components/charts/BarList'
import type { CardContext, CardDef } from './registry'

export const airportsCard: CardDef = {
  id: 'airports',
  title: 'Airports',
  group: 'core',
  render: ({ model }: CardContext) => {
    const rows = model!.byAirport.map((a) => ({ label: a.key, value: a.count }))
    return (
      <CardFrame title="Most-visited airports">
        <BarList rows={rows} max={10} formatValue={(n) => `${n}`} />
      </CardFrame>
    )
  },
}
