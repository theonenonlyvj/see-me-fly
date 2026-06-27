import CardFrame from '../components/CardFrame'
import BarList from '../components/charts/BarList'
import type { BarRow } from '../components/charts/BarList'
import { byTail } from '../../engine/stats'
import { flightsByTail } from '../lib/flight-filters'
import type { CardContext, CardDef } from './registry'

const ACCENT      = '#12c08a'
const ACCENT_GRAD = 'linear-gradient(90deg, #12c08a, #3ad6c0)'
const ACCENT_SOFT = '#ddf7ee'

export const sameMetalCard: CardDef = {
  id: 'sameMetal',
  title: 'Same metal',
  group: 'creative',
  accent: ACCENT,
  icon: '🔧',
  render: (ctx: CardContext) => {
    const tails = byTail(ctx.model!.scoped)
    const shown = tails.slice(0, 10)
    const rows: BarRow[] = shown.map((t) => ({ label: t.tail, value: t.count, id: t.tail }))
    const N = shown.reduce((s, t) => s + t.count, 0)
    const M = ctx.model!.scoped.length

    return (
      <CardFrame
        title="Same metal"
        eyebrow="Repeat aircraft"
        accent={ACCENT}
        accentGrad={ACCENT_GRAD}
        accentSoft={ACCENT_SOFT}
        icon="🔧"
      >
        <BarList
          rows={rows}
          max={5}
          seeAllTitle="Same metal"
          formatValue={(n) => `${n}`}
          accent={ACCENT}
          accentGrad={ACCENT_GRAD}
          accentSoft={ACCENT_SOFT}
          onRowClick={(row) => row.id && ctx.overlay?.openFlights(`Flights on ${row.label}`, flightsByTail(ctx.model!.scoped, row.id))}
        />
        <p style={{ marginTop: 14, fontSize: 11.5, color: 'var(--ink-2)', fontStyle: 'italic' }}>
          Tail data recorded from ~2013, based on {N} of {M} flights.
        </p>
      </CardFrame>
    )
  },
}
