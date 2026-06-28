import CardFrame from '../components/CardFrame'
import OverlayHistogram from '../components/charts/OverlayHistogram'
import { hourHistogram } from '../../engine/stats'
import type { CardContext, CardDef } from './registry'

const ACCENT = '#ff7a14'
const GRAD = 'linear-gradient(90deg, #ff7a14, #ffb347)'
const SOFT = '#ffeedd'
const DEP = '#ff7a14'
const ARR = '#1aa9ff'

const hourLabel = (h: number) => (h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`)

export const whenYouFlyOverlayCard: CardDef = {
  id: 'whenYouFlyOverlay',
  title: 'Departures vs arrivals',
  group: 'creative',
  accent: ACCENT,
  icon: '⏰',
  render: ({ model, overlay }: CardContext) => {
    const dep = hourHistogram(model!.scoped, 'dep')
    const arr = hourHistogram(model!.scoped, 'arr')
    const depPeak = dep.indexOf(Math.max(...dep))
    const arrPeak = arr.indexOf(Math.max(...arr))
    return (
      <CardFrame title="Departures vs arrivals" eyebrow="Both, on one 24h clock" accent={ACCENT} accentGrad={GRAD} accentSoft={SOFT} icon="⏰"
        onTitleClick={() => overlay?.openFlights('All flights', model!.scoped)}>
        <OverlayHistogram dep={dep} arr={arr} depColor={DEP} arrColor={ARR} />
        <p style={{ marginTop: 12, fontSize: 11.5, color: 'var(--ink-2)', fontStyle: 'italic' }}>
          You mostly depart around <b style={{ color: DEP }}>{hourLabel(depPeak)}</b> and land around <b style={{ color: ARR }}>{hourLabel(arrPeak)}</b>.
        </p>
      </CardFrame>
    )
  },
}
