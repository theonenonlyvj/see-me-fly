import CardFrame from '../components/CardFrame'
import { monogram } from '../lib/format'
import { airlineLogos } from '../../engine/reference'
import { flightsByAirline } from '../lib/flight-filters'
import type { Model } from '../state/useModel'
import type { OverlayApi } from '../components/Overlay'
import type { CardContext, CardDef } from './registry'

const ACCENT      = '#1aa9ff'
const ACCENT_GRAD = 'linear-gradient(90deg, #1aa9ff, #5ad0ff)'
const ACCENT_SOFT = '#e0f2ff'

function AirlineRows({ rows, peak, model, overlay }: {
  rows: { name: string; count: number; airlineCode: string }[]
  peak: number
  model: Model
  overlay?: OverlayApi
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 17 }}>
      {rows.map((r) => {
        const { initials, color } = monogram(r.name)
        const logo = airlineLogos[r.airlineCode]
        const pct = (r.count / peak) * 100
        return (
          <div key={r.name}
            onClick={() => overlay?.openFlights(r.name, flightsByAirline(model!.scoped, r.name))}
            role={overlay ? 'button' : undefined}
            style={{ display: 'grid', gridTemplateColumns: '40px 1fr auto', gap: 13, alignItems: 'center', cursor: overlay ? 'pointer' : undefined }}>
            {logo ? (
              <div style={{ width: 40, height: 40, borderRadius: '50%', display: 'grid', placeItems: 'center', background: '#fff', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08), 0 6px 14px -5px rgba(0,0,0,0.30)' }}>
                <img src={logo} alt="" width={30} height={30} style={{ objectFit: 'contain' }} />
              </div>
            ) : (
              <div style={{
                width: 40, height: 40, borderRadius: '50%', display: 'grid', placeItems: 'center',
                fontSize: 12.5, fontWeight: 900, letterSpacing: '0.02em', color: '#fff', background: color,
                boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.28), 0 6px 14px -5px rgba(0,0,0,0.42)',
              }}>{initials}</div>
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>{r.name}</div>
              <div style={{ height: 10, borderRadius: 999, background: ACCENT_SOFT, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 999, width: `${pct}%`, background: ACCENT_GRAD, boxShadow: `0 0 14px -2px color-mix(in srgb, ${ACCENT} 75%, transparent)` }} />
              </div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{r.count}</div>
          </div>
        )
      })}
    </div>
  )
}

function AirlinesList({ model, overlay }: CardContext) {
  const rows = model!.byAirline
  const peak = Math.max(...rows.map((r) => r.count), 1)
  return (
    <div>
      <AirlineRows rows={rows.slice(0, 5)} peak={peak} model={model} overlay={overlay} />
      {rows.length > 5 && (
        <button
          onClick={() => overlay?.openList('Airlines', <AirlineRows rows={rows} peak={peak} model={model} overlay={overlay} />)}
          style={{
            marginTop: 18, fontSize: 12.5, fontWeight: 800,
            background: ACCENT_GRAD, WebkitBackgroundClip: 'text', backgroundClip: 'text',
            WebkitTextFillColor: 'transparent', color: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
          }}
        >{`See all (${rows.length}) →`}</button>
      )}
      <div style={{ marginTop: 18, fontSize: 11.5, color: 'var(--ink-2)', fontStyle: 'italic' }}>
        Logos for major carriers; a monogram stands in for the rest.
      </div>
    </div>
  )
}

export const airlinesCard: CardDef = {
  id: 'airlines',
  title: 'Airlines',
  group: 'core',
  accent: ACCENT,
  icon: '🛩️',
  render: (ctx: CardContext) => (
    <CardFrame title="Airlines" eyebrow="Who flew you" accent={ACCENT} accentGrad={ACCENT_GRAD} accentSoft={ACCENT_SOFT} icon="🛩️">
      <AirlinesList {...ctx} />
    </CardFrame>
  ),
}
