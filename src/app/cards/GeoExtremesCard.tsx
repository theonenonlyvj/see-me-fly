import CardFrame from '../components/CardFrame'
import { fmtMiles } from '../lib/format'
import { geoExtremes, reconstructTrips, type Trip } from '../../engine/stats'
import { flightsByAirportIdent } from '../lib/flight-filters'
import type { Airport } from '../../engine'
import type { CardContext, CardDef } from './registry'
import type { OverlayApi } from '../components/Overlay'
import type { Model } from '../state/useModel'

const ACCENT      = '#6a3cff'
const ACCENT_GRAD = 'linear-gradient(90deg, #6a3cff, #9a6bff)'
const ACCENT_SOFT = '#ebe4ff'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function tripWhen(t: Trip): string {
  const d = t.departDate
  return `${MONTHS[Number(d.slice(5, 7)) - 1] ?? ''} ${d.slice(0, 4)}`.trim()
}

function coords(ap: Airport): string {
  const lat = `${Math.abs(ap.lat).toFixed(2)}°${ap.lat >= 0 ? 'N' : 'S'}`
  const lon = `${Math.abs(ap.lon).toFixed(2)}°${ap.lon >= 0 ? 'E' : 'W'}`
  return `${lat}, ${lon}`
}

function ExtremeRow({ label, airport, model, overlay }: { label: string; airport: Airport; model: Model; overlay?: OverlayApi }) {
  // Click-through reads model.flown (all-time) so a clicked row never opens an empty overlay.
  const open = () => overlay?.openFlights(`Flights via ${airport.iata || airport.ident}`, flightsByAirportIdent(model!.flown, airport.ident))
  return (
    <div
      onClick={open}
      role={overlay ? 'button' : undefined}
      style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 0', borderBottom: '1px solid var(--hair-2)', cursor: overlay ? 'pointer' : undefined,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', textTransform: 'capitalize', minWidth: 110 }}>
        {label}
      </div>
      <div style={{ textAlign: 'right' }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink)' }}>{airport.iata || airport.ident}</span>
        <div style={{ fontSize: 11.5, color: 'var(--ink-2)', fontWeight: 500 }}>{airport.name}</div>
        <div style={{ fontSize: 11, color: 'var(--ink-2)', fontVariantNumeric: 'tabular-nums' }}>{coords(airport)}</div>
      </div>
    </div>
  )
}

export const geoExtremesCard: CardDef = {
  id: 'geoExtremes',
  title: 'Geographic extremes',
  group: 'creative',
  accent: ACCENT,
  icon: '🧭',
  render: (ctx: CardContext) => {
    // Always operate over all-time flights; the year scope is inert for this card.
    const result = geoExtremes(ctx.model!.flown, ctx.settings)
    // Reconstruct trips once so a "farthest from home" row can open the WHOLE trip that reached
    // that airport, not just the record-setting leg. Map each flight's rawIndex → its trip.
    const trips = reconstructTrips(ctx.model!.flown, ctx.settings)
    const tripByRawIndex = new Map<number, Trip>()
    for (const t of trips) for (const f of t.flights) tripByRawIndex.set(f.rawIndex, t)

    return (
      <CardFrame
        title="Geographic extremes"
        eyebrow="The edges of your map"
        accent={ACCENT}
        accentGrad={ACCENT_GRAD}
        accentSoft={ACCENT_SOFT}
        icon="🧭"
      >
        {result.global === null ? (
          <p style={{ color: 'var(--ink-2)' }}>No data for this view.</p>
        ) : (
          <>
            {/* Global N/S/E/W — home-independent. */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <ExtremeRow label="Northernmost" airport={result.global.north.airport} model={ctx.model} overlay={ctx.overlay} />
              <ExtremeRow label="Southernmost" airport={result.global.south.airport} model={ctx.model} overlay={ctx.overlay} />
              <ExtremeRow label="Easternmost" airport={result.global.east.airport} model={ctx.model} overlay={ctx.overlay} />
              <ExtremeRow label="Westernmost" airport={result.global.west.airport} model={ctx.model} overlay={ctx.overlay} />
            </div>

            {/* Furthest from home — a single record: the farthest reach from ANY home you had. */}
            {result.byBase.length > 0 && (() => {
              const far = result.byBase.reduce((best, b) => (b.farthest.miles > best.farthest.miles ? b : best))
              const ap = far.farthest.airport
              const dest = ap.iata || ap.ident
              // Open the WHOLE trip that reached it (match a record leg by rawIndex), else the bare leg(s).
              const trip = far.farthestFlights.map((f) => tripByRawIndex.get(f.rawIndex)).find(Boolean)
              const open = () => {
                if (trip) ctx.overlay?.openFlights(`Trip to ${dest} · ${tripWhen(trip)}`, trip.flights)
                else ctx.overlay?.openFlights(`Furthest from home → ${dest}`, far.farthestFlights)
              }
              return (
                <div style={{ marginTop: 18 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: ACCENT, marginBottom: 8 }}>
                    Furthest from home
                  </div>
                  <div
                    onClick={open}
                    role={ctx.overlay ? 'button' : undefined}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
                      background: ACCENT_SOFT,
                      border: `1px solid color-mix(in srgb, ${ACCENT} 24%, transparent)`,
                      borderRadius: 14, padding: '12px 16px',
                      cursor: ctx.overlay ? 'pointer' : undefined,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>{ap.iata || ap.ident}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ap.name}</div>
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22,
                      color: ACCENT, fontVariantNumeric: 'tabular-nums', flexShrink: 0,
                    }}>
                      {fmtMiles(far.farthest.miles)}
                    </div>
                  </div>
                </div>
              )
            })()}
          </>
        )}
      </CardFrame>
    )
  },
}
