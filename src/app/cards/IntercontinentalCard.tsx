import CardFrame from '../components/CardFrame'
import BarList from '../components/charts/BarList'
import type { BarRow } from '../components/charts/BarList'
import { intercontinental } from '../../engine/stats'
import type { CardContext, CardDef } from './registry'

const ACCENT      = '#6a3cff'
const ACCENT_GRAD = 'linear-gradient(90deg, #6a3cff, #9a6bff)'
const ACCENT_SOFT = '#ebe4ff'

export const intercontinentalCard: CardDef = {
  id: 'intercontinental',
  title: 'Intercontinental',
  group: 'core',
  accent: ACCENT,
  icon: '🌐',
  render: (ctx: CardContext) => {
    const routes = intercontinental(ctx.model!.scoped, ctx.settings)
    const rows: BarRow[] = routes.slice(0, 10).map((r) => ({ label: r.key, value: r.count }))
    return (
      <CardFrame
        title="Intercontinental"
        eyebrow="Crossing continents"
        accent={ACCENT}
        accentGrad={ACCENT_GRAD}
        accentSoft={ACCENT_SOFT}
        icon="🌐"
      >
        <BarList
          rows={rows}
          max={10}
          formatValue={(n) => `${n}`}
          accent={ACCENT}
          accentGrad={ACCENT_GRAD}
          accentSoft={ACCENT_SOFT}
        />
      </CardFrame>
    )
  },
}
