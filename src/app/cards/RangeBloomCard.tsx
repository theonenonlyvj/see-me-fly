import CardFrame from '../components/CardFrame'
import RangeBloom, { CONTINENT_LEGEND } from '../components/charts/RangeBloom'
import { destinationsFromHome } from '../../engine/stats'
import { hasHome } from '../../engine/home'
import { homeKey } from '../lib/places'
import type { Continent } from '../../engine'
import type { CardContext, CardDef } from './registry'

const ACCENT = 'var(--indigo)'
const ACCENT_GRAD = 'linear-gradient(90deg, #6a3cff, #ff2fa8)'
const ACCENT_SOFT = 'var(--indigo-soft)'

export const rangeBloomCard: CardDef = {
  id: 'rangeBloom',
  title: 'Home-anchored range bloom',
  group: 'creative',
  accent: ACCENT,
  icon: '🧭',
  render: (ctx: CardContext) => {
    // Life-portrait: ALL-TIME flights (bearing/distance use the era-correct home per flight).
    const destinations = destinationsFromHome(ctx.model!.flown, ctx.settings)
    const farthest = destinations.length > 0 ? destinations[0] : null // rows are sorted farthest-first
    const homeLabel = homeKey(ctx.settings) ?? undefined

    // Which continents actually appear → only show those legend rows (keeps it honest & tight).
    const present = new Set<Continent>(
      destinations.map((d) => d.continent).filter((c): c is Continent => c != null),
    )
    const legend = CONTINENT_LEGEND.filter((row) => row.match.some((c) => present.has(c)))

    return (
      <CardFrame
        title="Home-anchored range bloom"
        eyebrow="Bearing & reach from home"
        accent={ACCENT}
        accentGrad={ACCENT_GRAD}
        accentSoft={ACCENT_SOFT}
        icon="🧭"
        poppable
      >
        {!hasHome(ctx.settings) || destinations.length === 0 ? (
          <p style={{ color: 'var(--ink-2)', fontSize: 13, lineHeight: 1.5 }}>
            {hasHome(ctx.settings)
              ? 'No destinations to bloom yet — add some flights away from home.'
              : 'Set your home airport in Settings to see how far your travels reach — each destination placed by its compass bearing and distance from the home you had then.'}
          </p>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              {/* the polar bloom */}
              <div style={{ flex: '1 1 300px', minWidth: 260 }}>
                <RangeBloom destinations={destinations} farthest={farthest} homeLabel={homeLabel} />
              </div>

              {/* legends */}
              <div style={{ flex: '0 0 auto', width: 108, display: 'flex', flexDirection: 'column', gap: 9, fontFamily: 'var(--font)' }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-2)' }}>
                  Continent
                </div>
                {legend.map((row) => (
                  <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, color: 'var(--ink)', fontWeight: 500 }}>
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: row.color, flex: 'none' }} />
                    {row.label}
                  </div>
                ))}

                {/* size legend: dot AREA = visit count */}
                <div style={{ marginTop: 4, display: 'flex', alignItems: 'flex-end', gap: 5 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#c8ccd6' }} />
                  <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#c8ccd6' }} />
                  <span style={{ width: 18, height: 18, borderRadius: '50%', background: '#c8ccd6' }} />
                </div>
                <div style={{ fontSize: 9, color: 'var(--ink-2)', fontWeight: 500, lineHeight: 1.3 }}>
                  Dot area = visit count
                </div>
              </div>
            </div>

            <p style={{ marginTop: 12, fontSize: 11.5, color: 'var(--ink-2)', fontStyle: 'italic', lineHeight: 1.45 }}>
              Rings are a √-distance scale (labeled in miles) so the near-home cluster stays legible;
              dot area = visits. Bearing &amp; distance use the home you had at each destination&apos;s
              most-recent visit.
            </p>
          </>
        )}
      </CardFrame>
    )
  },
}
