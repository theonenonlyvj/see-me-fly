import CardFrame from '../components/CardFrame'
import BarList from '../components/charts/BarList'
import type { BarRow } from '../components/charts/BarList'
import { byCountry } from '../../engine/stats'
import type { CardContext, CardDef } from './registry'

const ACCENT      = '#1aa9ff'
const ACCENT_GRAD = 'linear-gradient(90deg, #1aa9ff, #5ad0ff)'
const ACCENT_SOFT = '#e5f6ff'

function buildRows(ctx: CardContext): BarRow[] {
  const entries = byCountry(ctx.model!.scoped, ctx.settings)
  return entries.slice(0, 10).map((c) => {
    let label = `${c.flag} ${c.name}`.trim()
    let sub: string | undefined
    if (c.regions && c.regions.length > 0) {
      sub = `(${c.regions.length} state${c.regions.length === 1 ? '' : 's'})`
    }
    return { label, value: c.count, sub }
  })
}

export const countriesCard: CardDef = {
  id: 'countries',
  title: 'Countries & states',
  group: 'core',
  accent: ACCENT,
  icon: '🌍',
  render: (ctx: CardContext) => {
    const rows = buildRows(ctx)
    return (
      <CardFrame
        title="Countries & states"
        eyebrow="Where you've been"
        accent={ACCENT}
        accentGrad={ACCENT_GRAD}
        accentSoft={ACCENT_SOFT}
        icon="🌍"
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
