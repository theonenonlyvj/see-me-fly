import CardFrame from '../components/CardFrame'
import { WorldMap } from '../components/charts/WorldMap'
import type { CardContext, CardDef } from './registry'

const ACCENT      = 'var(--accent-4)'
const ACCENT_GRAD = 'linear-gradient(90deg, var(--accent-4), color-mix(in srgb, var(--accent-4) 60%, white))'
const ACCENT_SOFT = 'color-mix(in srgb, var(--accent-4) 10%, white)'

export const mapCard: CardDef = {
  id: 'map',
  title: 'Your map',
  group: 'creative',
  accent: ACCENT,
  icon: '🗺️',
  render: (ctx: CardContext) => (
    <CardFrame
      title="Your map"
      eyebrow="Flight routes"
      accent={ACCENT}
      accentGrad={ACCENT_GRAD}
      accentSoft={ACCENT_SOFT}
      icon="🗺️"
      fullWidth
    >
      <WorldMap flights={ctx.model!.scoped} accent="var(--accent-4)" />
    </CardFrame>
  ),
}
