import CardFrame from '../components/CardFrame'
import HourHistogram from '../components/charts/HourHistogram'
import { hourHistogram } from '../../engine/stats'
import type { CardContext, CardDef } from './registry'

const ACCENT      = 'var(--accent-6)'
const ACCENT_GRAD = 'linear-gradient(90deg, var(--accent-6), color-mix(in srgb, var(--accent-6) 70%, white))'
const ACCENT_SOFT = 'color-mix(in srgb, var(--accent-6) 12%, white)'

export const whenYouFlyCard: CardDef = {
  id: 'whenYouFly',
  title: 'When you fly',
  group: 'creative',
  accent: ACCENT,
  icon: '⏰',
  render: (ctx: CardContext) => {
    const flights = ctx.model!.scoped
    const depCounts = hourHistogram(flights, 'dep')
    const arrCounts = hourHistogram(flights, 'arr')

    return (
      <CardFrame
        title="When you fly"
        eyebrow="Departure & arrival hours"
        accent={ACCENT}
        accentGrad={ACCENT_GRAD}
        accentSoft={ACCENT_SOFT}
        icon="⏰"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <HourHistogram counts={depCounts} accent={ACCENT} label="Departures" />
          <HourHistogram counts={arrCounts} accent={ACCENT} label="Arrivals" />
        </div>
      </CardFrame>
    )
  },
}
