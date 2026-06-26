import CardFrame from '../components/CardFrame'
import BarList from '../components/charts/BarList'
import type { CardContext, CardDef } from './registry'

export const airlinesCard: CardDef = {
  id: 'airlines',
  title: 'Airlines',
  group: 'core',
  render: ({ model }: CardContext) => {
    const rows = model!.byAirline.map((a) => ({ label: a.name, value: a.count }))
    return (
      <CardFrame title="Airlines flown">
        <BarList rows={rows} max={5} formatValue={(n) => `${n}`} />
      </CardFrame>
    )
  },
}
