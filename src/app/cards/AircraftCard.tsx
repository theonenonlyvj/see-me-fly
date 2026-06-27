import CardFrame from '../components/CardFrame'
import BarList from '../components/charts/BarList'
import type { BarRow } from '../components/charts/BarList'
import { byAircraft } from '../../engine/stats'
import type { CardContext, CardDef } from './registry'

const ACCENT      = '#ff3d57'
const ACCENT_GRAD = 'linear-gradient(90deg, #ff3d57, #ff7a14)'
const ACCENT_SOFT = '#ffe8ec'

export const aircraftCard: CardDef = {
  id: 'aircraft',
  title: 'Aircraft',
  group: 'creative',
  accent: ACCENT,
  icon: '✈️',
  render: (ctx: CardContext) => {
    const { byClass, byType } = byAircraft(ctx.model!.scoped, ctx.settings.groupAircraftFamilies)

    const classRows: BarRow[] = byClass.map((c) => ({ label: c.cls, value: c.count }))
    const topTypes: BarRow[] = byType.map((t) => ({ label: t.type, value: t.count }))

    return (
      <CardFrame
        title="Aircraft"
        eyebrow="Fleet breakdown"
        accent={ACCENT}
        accentGrad={ACCENT_GRAD}
        accentSoft={ACCENT_SOFT}
        icon="✈️"
      >
        {/* By class */}
        <div style={{
          fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase',
          color: ACCENT, marginBottom: 10,
        }}>
          By class
        </div>
        <BarList
          rows={classRows}
          accent={ACCENT}
          accentGrad={ACCENT_GRAD}
          accentSoft={ACCENT_SOFT}
          formatValue={(n) => `${n}`}
        />

        {/* Top types */}
        {topTypes.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div style={{
              fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase',
              color: ACCENT, marginBottom: 10,
            }}>
              Top types
            </div>
            <BarList
              rows={topTypes}
              max={5}
              seeAllTitle="Aircraft types"
              accent={ACCENT}
              accentGrad={ACCENT_GRAD}
              accentSoft={ACCENT_SOFT}
              formatValue={(n) => `${n}`}
            />
          </div>
        )}

        {/* Caveat */}
        <p style={{ marginTop: 14, fontSize: 11.5, color: 'var(--ink-2)', fontStyle: 'italic' }}>
          blank types excluded
        </p>
      </CardFrame>
    )
  },
}
