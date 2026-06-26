import CardFrame from '../components/CardFrame'
import { fmtInt, fmtMiles, fmtDuration } from '../lib/format'
import type { CardContext, CardDef } from './registry'

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>{label}</div>
    </div>
  )
}

export const overviewCard: CardDef = {
  id: 'overview',
  title: 'Overview',
  group: 'core',
  render: ({ model }: CardContext) => {
    const t = model!.totals
    return (
      <CardFrame title="Overview">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--gap)' }}>
          <Stat label="Flights" value={fmtInt(t.count)} />
          <Stat label="Distance" value={fmtMiles(t.miles)} />
          <Stat label="Time in flight" value={fmtDuration(t.minutes)} />
          <Stat label="Unique airports" value={fmtInt(t.uniqueAirports)} />
          <Stat label="Airlines" value={fmtInt(t.airlines)} />
          <Stat label="Unique routes" value={fmtInt(t.uniqueRoutes)} />
        </div>
      </CardFrame>
    )
  },
}
