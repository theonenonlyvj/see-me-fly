import CardFrame from '../components/CardFrame'
import YearBlooms from '../components/charts/YearBlooms'
import { byYearMonthMatrix } from '../../engine/stats'
import type { CardContext, CardDef } from './registry'

const ACCENT      = 'var(--coral)'
const ACCENT_GRAD = 'linear-gradient(90deg, var(--coral), color-mix(in srgb, var(--coral) 70%, white))'
const ACCENT_SOFT = 'color-mix(in srgb, var(--coral) 12%, white)'

export const yearBloomsCard: CardDef = {
  id: 'yearBlooms',
  title: 'Small-Multiple Year Blooms',
  group: 'creative',
  accent: ACCENT,
  icon: '🌸',
  render: (ctx: CardContext) => {
    // All-time (life-portrait card): read model.flown, not the year-scoped slice.
    const matrix = byYearMonthMatrix(ctx.model!.flown)
    // Small multiples read most naturally in chronological order (early → recent).
    const data = [...matrix].sort((a, b) => a.year - b.year)

    return (
      <CardFrame
        title="Small-Multiple Year Blooms"
        eyebrow="Seasonal signature · by year"
        accent={ACCENT}
        accentGrad={ACCENT_GRAD}
        accentSoft={ACCENT_SOFT}
        icon="🌸"
        poppable
      >
        <YearBlooms data={data} accent={ACCENT} />
        <div style={{ marginTop: 14, fontSize: 12, color: 'var(--ink-2)', fontWeight: 600, textAlign: 'center' }}>
          spoke length = flights that month; all clocks share one scale. Jan sits at 12 o&apos;clock, clockwise.
        </div>
      </CardFrame>
    )
  },
}
