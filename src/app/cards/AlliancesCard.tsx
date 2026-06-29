import CardFrame from '../components/CardFrame'
import ProportionBar from '../components/charts/ProportionBar'
import { airlineGroups, type AllianceKey } from '../../engine/alliances'
import { flightsByAlliance, flightsByEffectiveAirline, flightsOtherUnaligned } from '../lib/flight-filters'
import type { CardContext, CardDef } from './registry'

const ACCENT = '#0ea5e9'
const GRAD = 'linear-gradient(90deg, #0ea5e9, #6dd3fc)'
const SOFT = '#e0f4fe'

const ALLIANCE_COLOR: Record<string, string> = { star: '#f59e0b', oneworld: '#4338ca', skyteam: '#0d9488' }
// distinct hues for promoted unaligned carriers (Southwest, etc.) + the "Other" tail
const PROMOTED_PALETTE = ['#e11d48', '#7c3aed', '#0891b2', '#db2777', '#65a30d']
const OTHER_COLOR = '#94a3b8'

export const alliancesCard: CardDef = {
  id: 'alliances',
  title: 'Alliances',
  group: 'creative',
  accent: ACCENT,
  icon: '🤝',
  render: ({ model, overlay }: CardContext) => {
    const groups = airlineGroups(model!.scoped)
    const promotedNames = groups.filter((g) => g.kind === 'airline').map((g) => g.label)
    let pIdx = 0
    const segments = groups.map((g) => ({
      label: g.label,
      value: g.count,
      id: g.key,
      color: g.kind === 'alliance' ? ALLIANCE_COLOR[g.key]
        : g.kind === 'other' ? OTHER_COLOR
        : PROMOTED_PALETTE[(pIdx++) % PROMOTED_PALETTE.length],
    }))
    return (
      <CardFrame title="Alliances" eyebrow="Star · Oneworld · SkyTeam" accent={ACCENT} accentGrad={GRAD} accentSoft={SOFT} icon="🤝">
        {segments.length === 0 ? (
          <p style={{ color: 'var(--ink-2)' }}>No identifiable airlines in this view.</p>
        ) : (
          <ProportionBar
            segments={segments}
            formatValue={(n) => `${n}`}
            onSegment={(s) => {
              if (!overlay) return
              const g = groups.find((x) => x.key === s.id)!
              const flights = g.kind === 'alliance' ? flightsByAlliance(model!.scoped, g.alliance as AllianceKey)
                : g.kind === 'other' ? flightsOtherUnaligned(model!.scoped, promotedNames)
                : flightsByEffectiveAirline(model!.scoped, g.label)
              overlay.openFlights(`${s.label} flights`, flights)
            }}
          />
        )}
        <p style={{ marginTop: 14, fontSize: 11.5, color: 'var(--ink-2)', fontStyle: 'italic' }}>
          Today's alliances; big independent carriers (e.g. Southwest) get their own slice, the rest are "Other (unaligned)".
          Defunct carriers count under their successor (US Airways → American → Oneworld).
        </p>
      </CardFrame>
    )
  },
}
