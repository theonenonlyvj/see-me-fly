import CardFrame from '../components/CardFrame'
import ProportionBar from '../components/charts/ProportionBar'
import { aircraftClassCounts } from '../../engine/stats'
import { flightsByAircraftClass } from '../lib/flight-filters'
import type { AircraftClass } from '../../engine'
import type { CardContext, CardDef } from './registry'

const ACCENT = '#a855f7'
const GRAD = 'linear-gradient(90deg, #a855f7, #c98bff)'
const SOFT = '#f1e7ff'

const CLASS_LABELS: Record<AircraftClass, string> = {
  wide: 'Widebody', narrow: 'Narrowbody', regional: 'Regional jet', prop: 'Propeller', unclassified: 'Other',
}
const CLASS_COLORS: Record<AircraftClass, string> = {
  wide: '#7c3aed', narrow: '#3b82f6', regional: '#0ea5e9', prop: '#10b981', unclassified: '#94a3b8',
}

export const aircraftClassBarCard: CardDef = {
  id: 'aircraftClassBar',
  title: 'Body types',
  group: 'creative',
  accent: ACCENT,
  icon: '🛩️',
  render: ({ model, overlay }: CardContext) => {
    const counts = aircraftClassCounts(model!.scoped)
    const segments = counts.map((c) => ({ label: CLASS_LABELS[c.cls], value: c.count, color: CLASS_COLORS[c.cls], id: c.cls }))
    return (
      <CardFrame title="Body types" eyebrow="Aircraft class mix" accent={ACCENT} accentGrad={GRAD} accentSoft={SOFT} icon="🛩️">
        {segments.length === 0 ? (
          <p style={{ color: 'var(--ink-2)' }}>No aircraft data in this view.</p>
        ) : (
          <ProportionBar
            segments={segments}
            formatValue={(n) => `${n}`}
            onSegment={(s) => overlay?.openFlights(`${s.label} flights`, flightsByAircraftClass(model!.scoped, s.id!))}
          />
        )}
      </CardFrame>
    )
  },
}
