import CardFrame from '../components/CardFrame'
import { fmtInt } from '../lib/format'
import { delayStats } from '../../engine/stats'
import type { EnrichedFlight } from '../../engine'
import type { CardContext, CardDef } from './registry'

const ACCENT      = '#ff2fa8'
const ACCENT_GRAD = 'linear-gradient(90deg, #ff2fa8, #6a3cff)'
const ACCENT_SOFT = '#ffe6f5'

function DelayRows({ flights, onOpen }: { flights: EnrichedFlight[]; onOpen?: (f: EnrichedFlight) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {flights.map((f) => (
        <div key={f.id}
          onClick={() => onOpen?.(f)}
          role={onOpen ? 'button' : undefined}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 13, color: 'var(--ink)', cursor: onOpen ? 'pointer' : undefined }}>
          <span style={{ fontWeight: 600 }}>{f.date} · {f.fromCode} → {f.toCode}</span>
          <span style={{ fontWeight: 800, color: ACCENT, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', marginLeft: 12 }}>+{fmtInt(f.delayMin!)}min</span>
        </div>
      ))}
    </div>
  )
}

export const delaysCard: CardDef = {
  id: 'delays',
  title: 'Delays',
  group: 'creative',
  accent: ACCENT,
  icon: '😤',
  render: (ctx: CardContext) => {
    const { onTimePct, counted, mostDelayed, canceled, diverted } = delayStats(ctx.model!.scoped)
    const openDetail = (f: EnrichedFlight) => ctx.overlay?.openFlight(f)
    const listBody = <DelayRows flights={mostDelayed} onOpen={openDetail} />
    // inline rows: open the flight WITH the full list beneath it, so Back returns to the list
    const onOpen = (f: EnrichedFlight) => { ctx.overlay?.openList('Most delayed', listBody); ctx.overlay?.openFlight(f) }

    return (
      <CardFrame title="Delays" eyebrow="Punctuality report" accent={ACCENT} accentGrad={ACCENT_GRAD} accentSoft={ACCENT_SOFT} icon="😤">
        {/* Hero: on-time % */}
        <div style={{ marginBottom: 22 }}>
          <div style={{
            fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 64, letterSpacing: '-0.03em', lineHeight: 0.95,
            background: ACCENT_GRAD, WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent',
            color: 'transparent', fontVariantNumeric: 'tabular-nums',
          }}>
            {onTimePct}%
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-2)', marginTop: 5 }}>
            on-time{counted > 0 && <span style={{ fontWeight: 500 }}> · over {fmtInt(counted)} flight{counted === 1 ? '' : 's'}</span>}
          </div>
        </div>

        {/* Most delayed */}
        {mostDelayed.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: ACCENT, marginBottom: 10 }}>
              Most delayed
            </div>
            <DelayRows flights={mostDelayed.slice(0, 5)} onOpen={onOpen} />
            {mostDelayed.length > 5 && (
              <button
                onClick={() => ctx.overlay?.openList('Most delayed', listBody)}
                style={{
                  marginTop: 14, fontSize: 12.5, fontWeight: 800,
                  background: ACCENT_GRAD, WebkitBackgroundClip: 'text', backgroundClip: 'text',
                  WebkitTextFillColor: 'transparent', color: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
                }}
              >{`See all (${mostDelayed.length}) →`}</button>
            )}
          </div>
        )}

        {/* Canceled / diverted footer */}
        <div style={{ fontSize: 12.5, color: 'var(--ink-2)', fontWeight: 600 }}>
          {fmtInt(canceled)} canceled · {fmtInt(diverted)} diverted
        </div>
      </CardFrame>
    )
  },
}
