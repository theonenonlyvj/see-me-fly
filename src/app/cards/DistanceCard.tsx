import CardFrame from '../components/CardFrame'
import BarList from '../components/charts/BarList'
import { flightsByDistanceBand } from '../lib/flight-filters'
import type { CardContext, CardDef } from './registry'

const ACCENT      = '#ff7a14'
const ACCENT_GRAD = 'linear-gradient(90deg, #ff7a14, #ffb347)'
const ACCENT_SOFT = '#ffeedd'

// band upper edges, matching engine/aggregate.ts BUCKETS (strict < on the boundary)
const EDGES = [0, 300, 700, 1500, 3000, 6000, Infinity]

export const distanceCard: CardDef = {
  id: 'distance',
  title: 'How far',
  group: 'core',
  accent: ACCENT,
  icon: '📏',
  render: ({ model, overlay }: CardContext) => {
    const rows = model!.distanceBuckets.map((b, i) => ({ label: b.label, value: b.count, id: String(i) }))
    return (
      <CardFrame title="How far" eyebrow="Distance bands" accent={ACCENT} accentGrad={ACCENT_GRAD} accentSoft={ACCENT_SOFT} icon="📏">
        <BarList rows={rows} max={rows.length} formatValue={(n) => `${n}`} accent={ACCENT} accentGrad={ACCENT_GRAD} accentSoft={ACCENT_SOFT}
          onRowClick={(row) => {
            const i = Number(row.id)
            overlay?.openFlights(`${row.label} flights`, flightsByDistanceBand(model!.scoped, EDGES[i], EDGES[i + 1]))
          }} />
      </CardFrame>
    )
  },
}
