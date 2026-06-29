import CardFrame from '../components/CardFrame'
import StackedColumns from '../components/charts/StackedColumns'
import { reconstructTrips, tripsForYear, tripSummary } from '../../engine/stats'
import { hasHome } from '../../engine/home'
import { flightsByYear } from '../lib/flight-filters'
import { fmtInt } from '../lib/format'
import type { CardContext, CardDef } from './registry'

const ACCENT = '#e11d48'
const GRAD = 'linear-gradient(90deg, #e11d48, #fb7185)'
const SOFT = '#ffe4ea'

export const nightsAwayCard: CardDef = {
  id: 'nightsAway',
  title: 'Nights away from home',
  group: 'creative',
  icon: '🛏️',
  accent: ACCENT,
  render: ({ model, settings, overlay }: CardContext) => {
    // All-time reconstruction, sliced to the active year-scope (keeps cross-year trips whole).
    const s = tripSummary(tripsForYear(reconstructTrips(model!.flown, settings), model!.scopeYear))
    return (
      <CardFrame title="Nights away from home" eyebrow="The home-presence cost" accent={ACCENT} accentGrad={GRAD} accentSoft={SOFT} icon="🛏️">
        {!hasHome(settings) ? (
          <p style={{ color: 'var(--ink-2)' }}>Set a home airport in Settings to estimate nights away.</p>
        ) : s.nightsByYear.length === 0 ? (
          <p style={{ color: 'var(--ink-2)' }}>No trips in this view.</p>
        ) : (() => {
          const minY = Math.min(...s.nightsByYear.map((x) => x.year))
          const maxY = Math.max(...s.nightsByYear.map((x) => x.year))
          const years: number[] = []
          for (let y = minY; y <= maxY; y++) years.push(y)
          const m = new Map(s.nightsByYear.map((x) => [x.year, x.nights]))
          const counts = years.map((y) => m.get(y) ?? 0)
          return (
            <>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 56, lineHeight: 0.9, background: GRAD, WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', color: 'transparent', fontVariantNumeric: 'tabular-nums' }}>
                  {fmtInt(s.totalNights)}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-2)' }}>nights away, across {s.tripCount} trips</div>
              </div>
              <StackedColumns years={years} series={[{ name: 'Nights', color: ACCENT, counts }]} accent={ACCENT}
                onYear={(y) => overlay?.openFlights(`Flights in ${y}`, flightsByYear(model!.scoped, y))} />
              {s.longest && s.longest.nights > 0 && (
                <p style={{ marginTop: 12, fontSize: 11.5, color: 'var(--ink-2)', fontStyle: 'italic' }}>
                  Longest single trip: <b style={{ color: ACCENT }}>{s.longest.nights} nights</b> ({s.longest.departDate} → {s.longest.returnDate}). Estimated from time between leaving home and returning.
                </p>
              )}
            </>
          )
        })()}
      </CardFrame>
    )
  },
}
