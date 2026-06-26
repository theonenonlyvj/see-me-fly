import CardFrame from '../components/CardFrame'
import CalendarHeatmap from '../components/charts/CalendarHeatmap'
import { byYearMonthMatrix } from '../../engine/stats'
import type { CardContext, CardDef } from './registry'

const ACCENT      = 'var(--accent-3)'
const ACCENT_GRAD = 'linear-gradient(90deg, var(--accent-3), color-mix(in srgb, var(--accent-3) 70%, white))'
const ACCENT_SOFT = 'color-mix(in srgb, var(--accent-3) 12%, white)'

export const intensityCard: CardDef = {
  id: 'intensity',
  title: 'Travel intensity',
  group: 'creative',
  accent: ACCENT,
  icon: '📅',
  render: (ctx: CardContext) => {
    const matrix = byYearMonthMatrix(ctx.model!.scoped)

    return (
      <CardFrame
        title="Travel intensity"
        eyebrow="Monthly heatmap"
        accent={ACCENT}
        accentGrad={ACCENT_GRAD}
        accentSoft={ACCENT_SOFT}
        icon="📅"
      >
        <CalendarHeatmap matrix={matrix} accent={ACCENT} />
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--ink-2)', fontWeight: 600, textAlign: 'center' }}>
          flights per month
        </div>
      </CardFrame>
    )
  },
}
