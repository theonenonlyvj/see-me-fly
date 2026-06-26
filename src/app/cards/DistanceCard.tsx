import CardFrame from '../components/CardFrame'
import BarList from '../components/charts/BarList'
import type { CardContext, CardDef } from './registry'

const ACCENT      = '#ff7a14'
const ACCENT_GRAD = 'linear-gradient(90deg, #ff7a14, #ffb347)'
const ACCENT_SOFT = '#ffeedd'

export const distanceCard: CardDef = {
  id: 'distance',
  title: 'How far',
  group: 'core',
  accent: ACCENT,
  icon: '📏',
  render: ({ model }: CardContext) => {
    const rows = model!.distanceBuckets.map((b) => ({ label: b.label, value: b.count }))
    return (
      <CardFrame title="How far" eyebrow="Distance bands" accent={ACCENT} accentGrad={ACCENT_GRAD} accentSoft={ACCENT_SOFT} icon="📏">
        <BarList rows={rows} max={rows.length} formatValue={(n) => `${n}`} accent={ACCENT} accentGrad={ACCENT_GRAD} accentSoft={ACCENT_SOFT} />
      </CardFrame>
    )
  },
}
