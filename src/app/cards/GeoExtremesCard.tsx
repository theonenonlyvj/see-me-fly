import CardFrame from '../components/CardFrame'
import { fmtMiles } from '../lib/format'
import { geoExtremes } from '../../engine/stats'
import { lookupAirport } from '../../engine/reference'
import type { Airport } from '../../engine'
import type { CardContext, CardDef } from './registry'

const ACCENT      = '#6a3cff'
const ACCENT_GRAD = 'linear-gradient(90deg, #6a3cff, #9a6bff)'
const ACCENT_SOFT = '#ebe4ff'

function ExtremeRow({ label, airport }: { label: string; airport: Airport }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '10px 0',
      borderBottom: '1px solid var(--hair-2)',
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', textTransform: 'capitalize', minWidth: 110 }}>
        {label}
      </div>
      <div style={{ textAlign: 'right' }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink)' }}>
          {airport.iata || airport.ident}
        </span>
        <div style={{ fontSize: 11.5, color: 'var(--ink-2)', fontWeight: 500 }}>
          {airport.name}
        </div>
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
    const homeAp = ctx.settings.home ? lookupAirport(ctx.settings.home) : null
    const result = geoExtremes(ctx.model!.scoped, homeAp ? { lat: homeAp.lat, lon: homeAp.lon } : undefined)

    return (
      <CardFrame
        title="Geographic extremes"
        eyebrow="The edges of your map"
        accent={ACCENT}
        accentGrad={ACCENT_GRAD}
        accentSoft={ACCENT_SOFT}
        icon="🧭"
      >
        {result === null ? (
          <p style={{ color: 'var(--ink-2)' }}>No data for this view.</p>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <ExtremeRow label="Northernmost" airport={result.north} />
              <ExtremeRow label="Southernmost" airport={result.south} />
              <ExtremeRow label="Easternmost" airport={result.east} />
              <ExtremeRow label="Westernmost" airport={result.west} />
            </div>

            {/* Farthest from home */}
            <div style={{
              marginTop: 18,
              background: ACCENT_SOFT,
              border: `1px solid color-mix(in srgb, ${ACCENT} 24%, transparent)`,
              borderRadius: 16,
              padding: '14px 18px',
            }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: ACCENT, marginBottom: 8 }}>
                Farthest from home
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)' }}>
                    {result.farthest.airport.iata || result.farthest.airport.ident}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 2 }}>
                    {result.farthest.airport.name}
                  </div>
                </div>
                <div style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  fontSize: 22,
                  color: ACCENT,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {fmtMiles(result.farthest.miles)}
                </div>
              </div>
            </div>
          </>
        )}
      </CardFrame>
    )
  },
}
