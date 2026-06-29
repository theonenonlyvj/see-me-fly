import CardFrame from '../components/CardFrame'
import BarList from '../components/charts/BarList'
import type { BarRow } from '../components/charts/BarList'
import { reconstructTrips, type Trip } from '../../engine/stats'
import { displayEndpoint } from '../lib/places'
import type { CardContext, CardDef } from './registry'

const ACCENT = '#14b8a6'
const GRAD = 'linear-gradient(90deg, #14b8a6, #5eead4)'
const SOFT = '#d6f7f1'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function whenLabel(t: Trip): string {
  const d = t.departDate
  const mo = MONTHS[Number(d.slice(5, 7)) - 1] ?? ''
  return `${mo} ${d.slice(0, 4)}`
}
function destLabel(t: Trip): string {
  const names = t.destinations.slice(0, 3).map(displayEndpoint)
  const extra = t.destinations.length - names.length
  return names.join(', ') + (extra > 0 ? ` +${extra}` : '') || 'local'
}

export const tripsCard: CardDef = {
  id: 'trips',
  title: 'Your trips',
  group: 'creative',
  accent: ACCENT,
  icon: '🧳',
  render: ({ model, settings, overlay }: CardContext) => {
    const trips = reconstructTrips(model!.scoped, settings)
      .slice()
      .sort((a, b) => (a.departDate < b.departDate ? 1 : -1)) // most recent first
    const rows: BarRow[] = trips.map((t, i) => ({
      label: `${whenLabel(t)} · ${destLabel(t)}`,
      value: t.flights.length,
      sub: t.nights > 0 ? `${t.nights} night${t.nights === 1 ? '' : 's'}` : 'day trip',
      id: String(i),
    }))
    return (
      <CardFrame title="Your trips" eyebrow="Journeys, not just legs" accent={ACCENT} accentGrad={GRAD} accentSoft={SOFT} icon="🧳">
        {!settings.home ? (
          <p style={{ color: 'var(--ink-2)' }}>Set a home airport in Settings to reconstruct your trips.</p>
        ) : rows.length === 0 ? (
          <p style={{ color: 'var(--ink-2)' }}>No trips in this view.</p>
        ) : (
          <>
            <BarList
              rows={rows}
              max={8}
              seeAllTitle="Your trips"
              formatValue={(n) => `${n} leg${n === 1 ? '' : 's'}`}
              accent={ACCENT} accentGrad={GRAD} accentSoft={SOFT}
              onRowClick={(row) => {
                const t = trips[Number(row.id)]
                if (t) overlay?.openFlights(`Trip · ${whenLabel(t)} → ${destLabel(t)}`, t.flights)
              }}
            />
            <p style={{ marginTop: 14, fontSize: 11.5, color: 'var(--ink-2)', fontStyle: 'italic' }}>
              A trip = consecutive legs from home and back. Tap one to see it on the map.
            </p>
          </>
        )}
      </CardFrame>
    )
  },
}
