import CardFrame from '../components/CardFrame'
import { fmtMiles } from '../lib/format'
import { odometer } from '../../engine/stats'
import type { CardContext, CardDef } from './registry'

const ACCENT      = '#1aa9ff'
const ACCENT_GRAD = 'linear-gradient(90deg, #1aa9ff, #5ad0ff)'
const ACCENT_SOFT = '#e0f2ff'

export const odometerCard: CardDef = {
  id: 'odometer',
  title: 'Around the world',
  group: 'creative',
  accent: ACCENT,
  icon: '🌎',
  render: (ctx: CardContext) => {
    const { miles, aroundEarth, toMoonPct } = odometer(ctx.model!.scoped)

    return (
      <CardFrame
        title="Around the world"
        eyebrow="Distance milestones"
        accent={ACCENT}
        accentGrad={ACCENT_GRAD}
        accentSoft={ACCENT_SOFT}
        icon="🌎"
      >
        {/* Hero: aroundEarth */}
        <div style={{ marginBottom: 24, textAlign: 'center' }}>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 96,
            letterSpacing: '-0.04em',
            lineHeight: 0.9,
            background: ACCENT_GRAD,
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            color: 'transparent',
            fontVariantNumeric: 'tabular-nums',
            filter: `drop-shadow(0 8px 26px color-mix(in srgb, ${ACCENT} 38%, transparent))`,
          }}>
            {aroundEarth}×
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink-2)', marginTop: 8, letterSpacing: '-0.01em' }}>
            around the Earth
          </div>
        </div>

        {/* Moon sub-stat */}
        <div style={{
          background: ACCENT_SOFT,
          border: `1px solid color-mix(in srgb, ${ACCENT} 24%, transparent)`,
          borderRadius: 16,
          padding: '14px 18px',
          marginBottom: 16,
          textAlign: 'center',
        }}>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 28,
            letterSpacing: '-0.02em',
            color: ACCENT,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {toMoonPct}%
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)', marginTop: 3 }}>
            of the way to the Moon
          </div>
        </div>

        {/* Total miles */}
        <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--ink-2)', fontWeight: 600 }}>
          Total: <span style={{ color: 'var(--ink)', fontWeight: 800 }}>{fmtMiles(miles)}</span>
        </div>
      </CardFrame>
    )
  },
}
