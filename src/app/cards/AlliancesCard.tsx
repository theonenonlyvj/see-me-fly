import CardFrame from '../components/CardFrame'
import ProportionBar from '../components/charts/ProportionBar'
import BarList from '../components/charts/BarList'
import { WorldMap } from '../components/charts/WorldMap'
import { airlineGroups, airlinesInAlliance, type Alliance } from '../../engine/alliances'
import { airlineLogos, allianceLogos } from '../../engine/reference'
import { flightsByAlliance, flightsByEffectiveAirline, flightsOtherUnaligned } from '../lib/flight-filters'
import type { CardContext, CardDef } from './registry'

const ACCENT = '#0ea5e9'
const GRAD = 'linear-gradient(90deg, #0ea5e9, #6dd3fc)'
const SOFT = '#e0f4fe'

const ALLIANCE_COLOR: Record<string, string> = { star: '#f59e0b', oneworld: '#4338ca', skyteam: '#0d9488' }
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
      color: g.kind === 'alliance' ? ALLIANCE_COLOR[g.key] : g.kind === 'other' ? OTHER_COLOR : PROMOTED_PALETTE[(pIdx++) % PROMOTED_PALETTE.length],
      iconUrl: g.kind === 'alliance' ? allianceLogos[g.key] : g.kind === 'airline' && g.code ? airlineLogos[g.code] : undefined,
    }))

    // Clicking an alliance → a popup with a map of that alliance's flights + the airlines you flew in it.
    const openAlliance = (alliance: Alliance, label: string) => {
      if (!overlay) return
      const flights = flightsByAlliance(model!.scoped, alliance)
      const rows = airlinesInAlliance(model!.scoped, alliance).map((a) => ({ label: a.name, value: a.count, id: a.name, iconUrl: airlineLogos[a.code], iconWide: true }))
      overlay.openList(`${label} — your airlines`, (
        <div>
          {flights.some((f) => f.resolved && !f.isLocalFlight) && (
            <div style={{ marginBottom: 14, borderRadius: 12, overflow: 'hidden' }}><WorldMap flights={flights} accent="var(--accent-4)" fit /></div>
          )}
          <BarList rows={rows} max={rows.length} formatValue={(n) => `${n}`} accent={ALLIANCE_COLOR[alliance]}
            onRowClick={(row) => overlay.openFlights(`${row.label} flights`, flightsByEffectiveAirline(model!.scoped, row.label))} />
        </div>
      ))
    }

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
              if (g.kind === 'alliance') openAlliance(g.alliance as Alliance, s.label)
              else if (g.kind === 'other') overlay.openFlights(s.label, flightsOtherUnaligned(model!.scoped, promotedNames))
              else overlay.openFlights(`${s.label} flights`, flightsByEffectiveAirline(model!.scoped, g.label))
            }}
          />
        )}
        <p style={{ marginTop: 14, fontSize: 11.5, color: 'var(--ink-2)', fontStyle: 'italic' }}>
          Today's alliances; big independents (e.g. Southwest) get their own slice. Tap an alliance to see its airlines &amp; map.
          Defunct carriers count under their successor (US Airways → American → Oneworld).
        </p>
      </CardFrame>
    )
  },
}
