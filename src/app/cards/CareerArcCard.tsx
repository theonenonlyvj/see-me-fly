import CardFrame from '../components/CardFrame'
import StackedColumns from '../components/charts/StackedColumns'
import { byYear } from '../../engine/aggregate'
import { flightsByYear } from '../lib/flight-filters'
import type { CardContext, CardDef } from './registry'

const ACCENT = '#7c5cff'
const GRAD = 'linear-gradient(90deg, #7c5cff, #a48bff)'
const SOFT = '#efeaff'

export const careerArcCard: CardDef = {
  id: 'careerArc',
  title: 'Career arc',
  group: 'creative',
  accent: ACCENT,
  icon: '📈',
  render: ({ model, overlay }: CardContext) => {
    const yb = byYear(model!.scoped)
    return (
      <CardFrame title="Career arc" eyebrow="Flights per year" accent={ACCENT} accentGrad={GRAD} accentSoft={SOFT} icon="📈"
        onTitleClick={() => overlay?.openFlights('All flights', model!.scoped)}>
        {yb.length === 0 ? (
          <p style={{ color: 'var(--ink-2)' }}>No flights in this view.</p>
        ) : (() => {
          const minY = Math.min(...yb.map((y) => y.year))
          const maxY = Math.max(...yb.map((y) => y.year))
          const years: number[] = []
          for (let y = minY; y <= maxY; y++) years.push(y)
          const cmap = new Map(yb.map((y) => [y.year, y.count]))
          const counts = years.map((y) => cmap.get(y) ?? 0)
          const total = counts.reduce((a, b) => a + b, 0)
          const peak = yb.reduce((a, b) => (b.count > a.count ? b : a))
          return (
            <>
              <StackedColumns years={years} series={[{ name: 'Flights', color: ACCENT, counts }]} accent={ACCENT}
                onYear={(y) => overlay?.openFlights(`Flights in ${y}`, flightsByYear(model!.scoped, y))} />
              <p style={{ marginTop: 12, fontSize: 11.5, color: 'var(--ink-2)', fontStyle: 'italic' }}>
                {total.toLocaleString('en-US')} flights across {years.length} years · peak {peak.count} in {peak.year}. Tap a year.
              </p>
            </>
          )
        })()}
      </CardFrame>
    )
  },
}
