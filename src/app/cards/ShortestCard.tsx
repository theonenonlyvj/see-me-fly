import { useState } from 'react'
import CardFrame from '../components/CardFrame'
import { fmtMiles, fmtDuration } from '../lib/format'
import { extremeFlights } from '../../engine/stats'
import type { EnrichedFlight } from '../../engine'
import type { CardContext, CardDef } from './registry'

const ACCENT      = '#ff2fa8'
const ACCENT_GRAD = 'linear-gradient(90deg, #ff2fa8, #6a3cff)'
const ACCENT_SOFT = '#ffe3f3'

type Metric = 'distance' | 'duration'

function Rows({ flights, metric, onOpen }: { flights: EnrichedFlight[]; metric: Metric; onOpen?: (f: EnrichedFlight) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {flights.map((f) => {
        const val = metric === 'distance' ? fmtMiles(f.distanceMi ?? 0) : fmtDuration(f.durationMin)
        return (
          <div key={f.id}
            onClick={() => onOpen?.(f)}
            role={onOpen ? 'button' : undefined}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 13, color: 'var(--ink)', cursor: onOpen ? 'pointer' : undefined }}>
            <span style={{ fontWeight: 600 }}>{f.date} · {f.fromCode}→{f.toCode}</span>
            <span style={{ fontWeight: 800, color: ACCENT, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', marginLeft: 12 }}>{val}</span>
          </div>
        )
      })}
    </div>
  )
}

function SeeAll({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      marginTop: 16, fontSize: 12.5, fontWeight: 800,
      background: ACCENT_GRAD, WebkitBackgroundClip: 'text', backgroundClip: 'text',
      WebkitTextFillColor: 'transparent', color: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
    }}>{label}</button>
  )
}

function ShortestFlights(ctx: CardContext) {
  const [metric, setMetric] = useState<Metric>('distance')
  const flights = extremeFlights(ctx.model!.scoped, metric, 'short', 50)
  const title = `Shortest by ${metric}`
  const openDetail = (f: EnrichedFlight) => ctx.overlay?.openFlight(f)
  const listBody = <Rows flights={flights} metric={metric} onOpen={openDetail} />
  // inline rows: open the flight WITH the full list beneath it, so Back returns to the list
  const openWithList = (f: EnrichedFlight) => { ctx.overlay?.openList(title, listBody); ctx.overlay?.openFlight(f) }

  return (
    <CardFrame title="Shortest flights" eyebrow="Quickest hops" accent={ACCENT} accentGrad={ACCENT_GRAD} accentSoft={ACCENT_SOFT} icon="✂️">
      <div style={{ display: 'inline-flex', padding: 3, gap: 2, marginBottom: 18, background: ACCENT_SOFT, borderRadius: 12, border: `1px solid color-mix(in srgb, ${ACCENT} 24%, transparent)` }}>
        {(['distance', 'duration'] as Metric[]).map((m) => (
          <button key={m} onClick={() => setMetric(m)}
            style={{
              fontFamily: 'var(--font)', fontSize: 12, fontWeight: 800,
              border: 'none', cursor: 'pointer', padding: '6px 13px', borderRadius: 9,
              color: metric === m ? '#fff' : ACCENT,
              background: metric === m ? `linear-gradient(90deg, ${ACCENT}, #6a3cff)` : 'transparent',
              boxShadow: metric === m ? `0 5px 12px -4px color-mix(in srgb, ${ACCENT} 78%, transparent)` : 'none',
            }}>
            {m}
          </button>
        ))}
      </div>

      {flights.length === 0 ? (
        <p style={{ color: 'var(--ink-2)' }}>No data for this view.</p>
      ) : (
        <>
          <Rows flights={flights.slice(0, 5)} metric={metric} onOpen={openWithList} />
          {flights.length > 5 && (
            <SeeAll label={`See all (${flights.length}) →`} onClick={() => ctx.overlay?.openList(title, listBody)} />
          )}
        </>
      )}
    </CardFrame>
  )
}

export const shortestCard: CardDef = {
  id: 'shortest',
  title: 'Shortest flights',
  group: 'creative',
  accent: ACCENT,
  icon: '✂️',
  render: (ctx: CardContext) => <ShortestFlights {...ctx} />,
}
