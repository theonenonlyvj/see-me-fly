import CardFrame from '../components/CardFrame'
import BarList from '../components/charts/BarList'
import type { BarRow } from '../components/charts/BarList'
import { commonLayovers } from '../../engine/stats'
import { displayEndpoint } from '../lib/places'
import { fmtDuration } from '../lib/format'
import type { CardContext, CardDef } from './registry'

const ACCENT      = '#f59e0b'
const ACCENT_GRAD = 'linear-gradient(90deg, #f59e0b, #fbbf24)'
const ACCENT_SOFT = '#fef3c7'

export const layoversCard: CardDef = {
  id: 'layovers',
  title: 'Common layovers',
  group: 'creative',
  accent: ACCENT,
  icon: '🔁',
  render: (ctx: CardContext) => {
    const entries = commonLayovers(ctx.model!.scoped, ctx.settings)
    const rows: BarRow[] = entries.slice(0, 10).map((e) => ({
      label: displayEndpoint(e.key),
      value: e.count,
      sub: `~${fmtDuration(e.avgGapMin)} typical`,
    }))
    return (
      <CardFrame
        title="Common layovers"
        eyebrow={`Where you connect · ≤ ${ctx.settings.layoverMaxHours}h`}
        accent={ACCENT}
        accentGrad={ACCENT_GRAD}
        accentSoft={ACCENT_SOFT}
        icon="🔁"
      >
        <BarList rows={rows} max={10} formatValue={(n) => `${n}`} accent={ACCENT} accentGrad={ACCENT_GRAD} accentSoft={ACCENT_SOFT} />
      </CardFrame>
    )
  },
}
