import CardFrame from '../components/CardFrame'
import BarList from '../components/charts/BarList'
import type { BarRow } from '../components/charts/BarList'
import { byCountry } from '../../engine/stats'
import { flightsByCountry, flightsByRegion } from '../lib/flight-filters'
import type { CardContext, CardDef } from './registry'

const ACCENT      = '#1aa9ff'
const ACCENT_GRAD = 'linear-gradient(90deg, #1aa9ff, #5ad0ff)'
const ACCENT_SOFT = '#e5f6ff'

// Short parenthetical labels for the split-state rows, e.g. "Texas (USA)".
const SHORT: Record<string, string> = { US: 'USA', IN: 'India', MX: 'Mexico' }

function buildRows(ctx: CardContext): BarRow[] {
  const entries = byCountry(ctx.model!.scoped, ctx.settings)
  const splitSet = new Set(ctx.settings.splitCountriesByState ?? [])
  const rows: BarRow[] = []

  for (const c of entries) {
    if (splitSet.has(c.code) && c.regions && c.regions.length > 0) {
      // Promote each state to its own row, ranked inline with whole countries.
      const short = SHORT[c.code] ?? c.name
      for (const r of c.regions) {
        rows.push({ label: `${c.flag} ${r.name} (${short})`.trim(), value: r.count, id: `r:${r.region}` })
      }
    } else {
      // Whole-country row; for US/IN/MX keep the expandable state breakdown.
      const label = `${c.flag} ${c.name}`.trim()
      let sub: string | undefined
      let subRows: BarRow['subRows']
      if (c.regions && c.regions.length > 0) {
        sub = `(${c.regions.length} state${c.regions.length === 1 ? '' : 's'})`
        subRows = c.regions.map((r) => ({ label: r.name, value: r.count }))
      }
      rows.push({ label, value: c.count, sub, subRows, id: c.code })
    }
  }

  return rows.sort((a, b) => b.value - a.value)
}

export const countriesCard: CardDef = {
  id: 'countries',
  title: 'Countries & states',
  group: 'core',
  accent: ACCENT,
  icon: '🌍',
  render: (ctx: CardContext) => {
    const rows = buildRows(ctx)
    return (
      <CardFrame
        title="Countries & states"
        eyebrow="Where you've been"
        accent={ACCENT}
        accentGrad={ACCENT_GRAD}
        accentSoft={ACCENT_SOFT}
        icon="🌍"
      >
        <BarList
          rows={rows}
          max={5}
          seeAllTitle="Countries & states"
          formatValue={(n) => `${n}`}
          accent={ACCENT}
          accentGrad={ACCENT_GRAD}
          accentSoft={ACCENT_SOFT}
          onRowClick={(row) => {
            if (!row.id) return
            if (row.id.startsWith('r:')) {
              ctx.overlay?.openFlights(`Flights in ${row.label}`, flightsByRegion(ctx.model!.scoped, row.id.slice(2)))
            } else {
              ctx.overlay?.openFlights(`Flights touching ${row.label}`, flightsByCountry(ctx.model!.scoped, row.id))
            }
          }}
        />
        {(ctx.settings.splitCountriesByState ?? []).length > 0 && (
          <p style={{ marginTop: 14, fontSize: 11.5, color: 'var(--ink-2)', fontStyle: 'italic' }}>
            Split into states — choose which countries (or group them) in Settings.
          </p>
        )}
      </CardFrame>
    )
  },
}
