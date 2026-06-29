import CardFrame from '../components/CardFrame'
import ProportionBar from '../components/charts/ProportionBar'
import { byAlliance, ALLIANCE_LABEL, type AllianceKey } from '../../engine/alliances'
import { flightsByAlliance } from '../lib/flight-filters'
import type { CardContext, CardDef } from './registry'

const ACCENT = '#0ea5e9'
const GRAD = 'linear-gradient(90deg, #0ea5e9, #6dd3fc)'
const SOFT = '#e0f4fe'

const ALLIANCE_COLORS: Record<AllianceKey, string> = {
  star: '#f59e0b', oneworld: '#4338ca', skyteam: '#0d9488', none: '#94a3b8',
}

export const alliancesCard: CardDef = {
  id: 'alliances',
  title: 'Alliances',
  group: 'creative',
  accent: ACCENT,
  icon: '🤝',
  render: ({ model, overlay }: CardContext) => {
    const rows = byAlliance(model!.scoped)
    const segments = rows.map((r) => ({ label: ALLIANCE_LABEL[r.alliance], value: r.count, color: ALLIANCE_COLORS[r.alliance], id: r.alliance }))
    return (
      <CardFrame title="Alliances" eyebrow="Star · Oneworld · SkyTeam" accent={ACCENT} accentGrad={GRAD} accentSoft={SOFT} icon="🤝">
        {segments.length === 0 ? (
          <p style={{ color: 'var(--ink-2)' }}>No identifiable airlines in this view.</p>
        ) : (
          <ProportionBar
            segments={segments}
            formatValue={(n) => `${n}`}
            onSegment={(s) => overlay?.openFlights(`${s.label} flights`, flightsByAlliance(model!.scoped, s.id as AllianceKey))}
          />
        )}
        <p style={{ marginTop: 14, fontSize: 11.5, color: 'var(--ink-2)', fontStyle: 'italic' }}>
          Today's alliances. Low-cost &amp; independent carriers are "Unaligned"; defunct carriers count under
          their successor (US Airways → American → Oneworld, Continental → United → Star).
        </p>
      </CardFrame>
    )
  },
}
