import CardFrame from '../components/CardFrame'
import { fmtInt } from '../lib/format'
import { records, groundGaps } from '../../engine/stats'
import { flightsByDate, flightsByYearMonth, flightsByYear } from '../lib/flight-filters'
import type { CardContext, CardDef } from './registry'

const ACCENT      = '#ff7a14'
const ACCENT_GRAD = 'linear-gradient(90deg, #ff7a14, #ffb347)'
const ACCENT_SOFT = '#ffeedd'

function ordinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}

function StatRow({ label, value, sub, onClick }: { label: string; value: string; sub?: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        padding: '10px 0',
        borderBottom: '1px solid var(--hair-2)',
        cursor: onClick ? 'pointer' : undefined,
      }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)', textTransform: 'capitalize', display: 'flex', alignItems: 'center', gap: 6 }}>
        {label}{onClick && <span style={{ fontSize: 10, opacity: 0.7 }}>↗</span>}
      </div>
      <div style={{ textAlign: 'right' }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
          {value}
        </span>
        {sub && <div style={{ fontSize: 11.5, color: 'var(--ink-2)', fontWeight: 500 }}>{sub}</div>}
      </div>
    </div>
  )
}

function GapList({ gaps }: { gaps: { days: number; from: string; to: string }[] }) {
  if (gaps.length === 0) return <p style={{ color: 'var(--ink-2)' }}>No grounded gaps.</p>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {gaps.map((g, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 13, color: 'var(--ink)' }}>
          <span style={{ color: 'var(--ink-2)' }}>{g.from} → {g.to}</span>
          <span style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums', marginLeft: 12 }}>{fmtInt(g.days)} days</span>
        </div>
      ))}
    </div>
  )
}

export const recordsCard: CardDef = {
  id: 'records',
  title: 'Records & streaks',
  group: 'creative',
  accent: ACCENT,
  icon: '🏆',
  render: (ctx: CardContext) => {
    const today = new Date().toISOString().slice(0, 10)
    const { mostInDay, busiestMonth, busiestYear, longestGapDays, milestones } = records(ctx.model!.scoped, today)

    return (
      <CardFrame
        title="Records & streaks"
        eyebrow="Personal bests"
        accent={ACCENT}
        accentGrad={ACCENT_GRAD}
        accentSoft={ACCENT_SOFT}
        icon="🏆"
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {mostInDay.count > 0 && (
            <StatRow
              label="Busiest day"
              value={mostInDay.date}
              sub={`${fmtInt(mostInDay.count)} flights`}
              onClick={() => ctx.overlay?.openFlights(`Flights on ${mostInDay.date}`, flightsByDate(ctx.model!.scoped, mostInDay.date))}
            />
          )}
          {busiestMonth.ym && (
            <StatRow
              label="Busiest month"
              value={busiestMonth.ym}
              sub={`${fmtInt(busiestMonth.count)} flights`}
              onClick={() => ctx.overlay?.openFlights(`Flights in ${busiestMonth.ym}`, flightsByYearMonth(ctx.model!.scoped, busiestMonth.ym))}
            />
          )}
          {busiestYear.year > 0 && (
            <StatRow
              label="Busiest year"
              value={String(busiestYear.year)}
              sub={`${fmtInt(busiestYear.count)} flights`}
              onClick={() => ctx.overlay?.openFlights(`Flights in ${busiestYear.year}`, flightsByYear(ctx.model!.scoped, busiestYear.year))}
            />
          )}
          {longestGapDays > 0 && (
            <StatRow
              label="Longest grounded gap"
              value={`${fmtInt(longestGapDays)} days`}
              onClick={() => ctx.overlay?.openList('Longest grounded gaps', <GapList gaps={groundGaps(ctx.model!.scoped, 15)} />)}
            />
          )}
        </div>

        {/* Milestones */}
        {milestones.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div style={{
              fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase',
              color: ACCENT, marginBottom: 10,
            }}>
              Milestones
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {milestones.map(({ ordinal, flight }) => (
                <div key={ordinal}
                  onClick={() => { ctx.overlay?.openFlights('Milestones', milestones.map((m) => m.flight)); ctx.overlay?.openFlight(flight) }}
                  role={ctx.overlay ? 'button' : undefined}
                  style={{
                  background: ACCENT_SOFT,
                  border: `1px solid color-mix(in srgb, ${ACCENT} 20%, transparent)`,
                  borderRadius: 12,
                  padding: '10px 14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: ctx.overlay ? 'pointer' : undefined,
                }}>
                  <div>
                    <span style={{ fontWeight: 800, color: ACCENT, fontSize: 14 }}>
                      {ordinalSuffix(ordinal)} flight
                    </span>
                    <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>
                      {flight.date} · {flight.fromCode} → {flight.toCode}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardFrame>
    )
  },
}
