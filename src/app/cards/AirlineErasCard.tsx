import CardFrame from '../components/CardFrame'
import StackedColumns from '../components/charts/StackedColumns'
import { airlineByYear } from '../../engine/stats'
import { flightsByYear } from '../lib/flight-filters'
import type { CardContext, CardDef } from './registry'

const ACCENT = '#0a58ff'
const GRAD = 'linear-gradient(90deg, #0a58ff, #5b8def)'
const SOFT = '#e3ecff'
const PALETTE = ['#0a58ff', '#ff3d57', '#f59e0b', '#9aa7b8'] // top airline, 2nd, 3rd, Other

export const airlineErasCard: CardDef = {
  id: 'airlineEras',
  title: 'Airline loyalty',
  group: 'creative',
  accent: ACCENT,
  icon: '🎟️',
  render: ({ model, overlay }: CardContext) => {
    const { years, series } = airlineByYear(model!.scoped, 3)
    return (
      <CardFrame title="Airline loyalty" eyebrow="Who flew you, by year" accent={ACCENT} accentGrad={GRAD} accentSoft={SOFT} icon="🎟️"
        onTitleClick={() => overlay?.openFlights('All flights', model!.scoped)}>
        {years.length === 0 ? (
          <p style={{ color: 'var(--ink-2)' }}>No flights in this view.</p>
        ) : (() => {
          const minY = Math.min(...years)
          const maxY = Math.max(...years)
          const cont: number[] = []
          for (let y = minY; y <= maxY; y++) cont.push(y)
          const idx = new Map(years.map((y, i) => [y, i]))
          // "Other" is the last series → paint it gray regardless of count
          const cseries = series.map((s, i) => ({
            name: s.name,
            color: s.name === 'Other' ? PALETTE[3] : PALETTE[Math.min(i, 2)],
            counts: cont.map((y) => { const j = idx.get(y); return j === undefined ? 0 : s.counts[j] }),
          }))
          return (
            <StackedColumns years={cont} series={cseries} accent={ACCENT}
              onYear={(y) => overlay?.openFlights(`Flights in ${y}`, flightsByYear(model!.scoped, y))} />
          )
        })()}
      </CardFrame>
    )
  },
}
