import type { ReactNode } from 'react'
import CardFrame from '../components/CardFrame'
import SpiralYearClock from '../components/charts/SpiralYearClock'
import { buildHomeColoring } from '../lib/home-colors'
import { busiestWeek } from '../../engine/stats'
import type { CardContext, CardDef } from './registry'

const ACCENT = 'var(--coral)'
// The hero centerpiece: use the reserved 6-stop hero gradient for the accent strip / eyebrow.
const ACCENT_GRAD = 'var(--grad-hero)'
const ACCENT_SOFT = 'color-mix(in srgb, var(--coral) 12%, white)'

function LegBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 800, color: 'var(--ink-2)', marginBottom: 8 }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function LegRow({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.25 }}>
      {children}
    </div>
  )
}

export const spiralAloftCard: CardDef = {
  id: 'spiralAloft',
  title: '13 Years Aloft',
  group: 'creative',
  accent: ACCENT,
  icon: '🌀',
  render: (ctx: CardContext) => {
    // Life-portrait hero: ALL-TIME flights, never the year-scoped slice.
    const flights = ctx.model!.flown
    const coloring = buildHomeColoring(ctx.settings)
    const busiest = busiestWeek(flights.filter((f) => !f.isLocalFlight))
    const nonLocal = flights.filter((f) => !f.isLocalFlight).length

    return (
      <CardFrame
        title="13 Years Aloft"
        eyebrow="Every flight, every year"
        accent={ACCENT}
        accentGrad={ACCENT_GRAD}
        accentSoft={ACCENT_SOFT}
        icon="🌀"
        poppable
      >
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* the spiral (left) */}
          <div style={{ flex: '1 1 360px', minWidth: 300, maxWidth: 480 }}>
            <SpiralYearClock flights={flights} colorFor={coloring.colorFor} busiest={busiest} />
          </div>

          {/* the legend panel (right) */}
          <div style={{ flex: '1 1 240px', minWidth: 220, maxWidth: 340, fontFamily: 'var(--font)' }}>
            <LegBlock title="How to read">
              <LegRow>
                <span style={{ fontWeight: 700, color: 'var(--ink-2)', minWidth: 54 }}>Angle</span>
                month · Jan at top ↻
              </LegRow>
              <LegRow>
                <span style={{ fontWeight: 700, color: 'var(--ink-2)', minWidth: 54 }}>Ring</span>
                year · earliest inner → latest outer
              </LegRow>
              <LegRow>
                <span style={{ fontWeight: 700, color: 'var(--ink-2)', minWidth: 54 }}>Weight</span>
                <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ width: 16, height: 2, background: 'var(--ink)', borderRadius: 2 }} />
                  <span style={{ width: 16, height: 5, background: 'var(--ink)', borderRadius: 2 }} />
                </span>
                log distance
              </LegRow>
            </LegBlock>

            {coloring.hasHomes && coloring.legend.length > 0 && (
              <LegBlock title="Home that day">
                {coloring.legend.map((row) => (
                  <LegRow key={row.label}>
                    <span style={{ width: 13, height: 13, borderRadius: 4, background: row.color, flex: '0 0 auto' }} />
                    {row.label}
                  </LegRow>
                ))}
              </LegBlock>
            )}

            <div style={{ fontSize: 11, color: 'var(--ink-2)', lineHeight: 1.4 }}>
              {nonLocal.toLocaleString('en-US')} flights, one tick each — fixed-count, not area-filled.
              Inner rings look dense only because early years hold fewer, tighter marks; tick weight = log distance.
            </div>
          </div>
        </div>
      </CardFrame>
    )
  },
}
