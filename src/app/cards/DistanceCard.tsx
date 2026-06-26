import CardFrame from '../components/CardFrame'
import BarList from '../components/charts/BarList'
import type { CardContext, CardDef } from './registry'

export const distanceCard: CardDef = {
  id: 'distance',
  title: 'Distance buckets',
  group: 'core',
  render: ({ model }: CardContext) => {
    const rows = model!.distanceBuckets.map((b) => ({ label: b.label, value: b.count }))
    return (
      <CardFrame title="How far">
        <BarList rows={rows} max={rows.length} formatValue={(n) => `${n}`} />
      </CardFrame>
    )
  },
}
