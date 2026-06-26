import CardFrame from '../components/CardFrame'
import { fmtInt } from '../lib/format'
import { records } from '../../engine/stats'
import type { CardContext, CardDef } from './registry'

const ACCENT      = '#ff7a14'
const ACCENT_GRAD = 'linear-gradient(90deg, #ff7a14, #ffb347)'
const ACCENT_SOFT = '#ffeedd'

function ordinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}

function StatRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      padding: '10px 0',
      borderBottom: '1px solid var(--hair-2)',
    }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)', textTransform: 'capitalize' }}>
        {label}
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
              label="Most flights in a day"
              value={`${fmtInt(mostInDay.count)} flights`}
              sub={mostInDay.date}
            />
          )}
          {busiestMonth.ym && (
            <StatRow
              label="Busiest month"
              value={busiestMonth.ym}
              sub={`${fmtInt(busiestMonth.count)} flights`}
            />
          )}
          {busiestYear.year > 0 && (
            <StatRow
              label="Busiest year"
              value={String(busiestYear.year)}
              sub={`${fmtInt(busiestYear.count)} flights`}
            />
          )}
          {longestGapDays > 0 && (
            <StatRow
              label="Longest grounded gap"
              value={`${fmtInt(longestGapDays)} days`}
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
                <div key={ordinal} style={{
                  background: ACCENT_SOFT,
                  border: `1px solid color-mix(in srgb, ${ACCENT} 20%, transparent)`,
                  borderRadius: 12,
                  padding: '10px 14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
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
