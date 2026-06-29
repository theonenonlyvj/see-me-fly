import CardFrame from '../components/CardFrame'
import { reconstructTrips, tripsForYear, tripSummary, WEEKDAY_LABELS } from '../../engine/stats'
import { hasHome } from '../../engine/home'
import type { CardContext, CardDef } from './registry'

const ACCENT = '#0d9488'
const GRAD = 'linear-gradient(90deg, #0d9488, #2dd4bf)'
const SOFT = '#d6f5ef'

function Tile({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ flex: 1, minWidth: 92, background: '#fff', border: '1px solid var(--hair-2)', borderRadius: 14, padding: '13px 15px' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 28, lineHeight: 1, color: ACCENT, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-2)', marginTop: 5 }}>{label}</div>
    </div>
  )
}

export const commuterCadenceCard: CardDef = {
  id: 'commuterCadence',
  title: 'Commuter cadence',
  group: 'creative',
  accent: ACCENT,
  icon: '🔁',
  render: ({ model, settings }: CardContext) => {
    // All-time reconstruction, sliced to the active year-scope (keeps cross-year trips whole).
    const s = tripSummary(tripsForYear(reconstructTrips(model!.flown, settings), model!.scopeYear))
    return (
      <CardFrame title="Commuter cadence" eyebrow="The shape of a trip" accent={ACCENT} accentGrad={GRAD} accentSoft={SOFT} icon="🔁">
        {!hasHome(settings) ? (
          <p style={{ color: 'var(--ink-2)' }}>Set a home airport in Settings to reconstruct your trips.</p>
        ) : s.tripCount === 0 ? (
          <p style={{ color: 'var(--ink-2)' }}>No trips in this view.</p>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <Tile value={`${s.tripCount}`} label="Trips reconstructed" />
              <Tile value={`${s.medianNights}`} label="Median nights / trip" />
              <Tile value={`${s.businessPct}%`} label="Classic business-shape trips" />
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
              {s.commonOutbound !== null && s.commonReturn !== null ? (
                <>You typically leave on <b style={{ color: ACCENT }}>{WEEKDAY_LABELS[s.commonOutbound]}</b> and return on <b style={{ color: ACCENT }}>{WEEKDAY_LABELS[s.commonReturn]}</b> — about {s.medianNights} nights out.</>
              ) : 'Round-trip cadence will appear once there are completed trips.'}
            </p>
            <p style={{ marginTop: 8, fontSize: 11, color: 'var(--ink-2)', fontStyle: 'italic' }}>
              A trip = consecutive legs from home and back ({s.roundTrips} of {s.tripCount} round-tripped).
            </p>
          </>
        )}
      </CardFrame>
    )
  },
}
