import CardFrame from '../components/CardFrame'
import { fmtInt, fmtMiles, fmtDurationDays } from '../lib/format'
import type { CardContext, CardDef } from './registry'

const ACCENT      = '#ff3d57'
const ACCENT_GRAD = 'linear-gradient(90deg, #ff3d57, #ff2fa8)'
const ACCENT_SOFT = '#ffe8ec'

function StatCell({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ background: '#fff', padding: '15px 16px' }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-2)', marginBottom: 5 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 27, letterSpacing: '-0.02em', color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
        {value}{sub && <small style={{ fontFamily: 'var(--font)', fontSize: 13, fontWeight: 700, color: 'var(--ink-2)' }}> {sub}</small>}
      </div>
    </div>
  )
}

export const overviewCard: CardDef = {
  id: 'overview',
  title: 'Overview',
  group: 'core',
  accent: ACCENT,
  icon: '🧭',
  render: ({ model }: CardContext) => {
    const t = model!.totals
    const earthCircles = (t.miles / 24901).toFixed(1)

    return (
      <CardFrame title="Overview" eyebrow="The big picture" accent={ACCENT} accentGrad={ACCENT_GRAD} accentSoft={ACCENT_SOFT} icon="🧭">
        {/* hero row: oversized Flights number + Distance */}
        <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 24 }}>
          {/* Flights — oversized gradient hero */}
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-2)', marginBottom: 4 }}>Flights</div>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 84,
              letterSpacing: '-0.035em',
              lineHeight: 0.9,
              background: 'linear-gradient(120deg, #ff3d57 0%, #ff7a14 28%, #ff2fa8 60%, #6a3cff 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              color: 'transparent',
              filter: 'drop-shadow(0 8px 26px rgba(255,47,168,0.22))',
              fontVariantNumeric: 'tabular-nums',
            }}>{fmtInt(t.count)}</div>
          </div>
          {/* Distance */}
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-2)', marginBottom: 4 }}>Distance flown</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 46, letterSpacing: '-0.035em', lineHeight: 0.9, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
              {fmtMiles(t.miles)}
            </div>
            <div style={{
              marginTop: 8, fontSize: 12.5, fontWeight: 800,
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'linear-gradient(90deg, var(--coral), var(--magenta))',
              WebkitBackgroundClip: 'text', backgroundClip: 'text',
              WebkitTextFillColor: 'transparent', color: 'transparent',
            }}>↻ {earthCircles}× around the Earth</div>
          </div>
        </div>

        {/* 2×2 stat grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 1,
          background: 'var(--hair-2)',
          border: '1px solid var(--hair-2)',
          borderRadius: 16,
          overflow: 'hidden',
        }}>
          <StatCell label="Time in flight" value={fmtDurationDays(t.minutes)} />
          <StatCell label="Unique airports" value={fmtInt(t.uniqueAirports)} />
          <StatCell label="Airlines" value={fmtInt(t.airlines)} />
          <StatCell label="Unique routes" value={fmtInt(t.uniqueRoutes)} />
        </div>
      </CardFrame>
    )
  },
}
