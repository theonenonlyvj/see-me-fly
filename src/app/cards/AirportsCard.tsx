import CardFrame from '../components/CardFrame'
import BarList from '../components/charts/BarList'
import type { BarRow } from '../components/charts/BarList'
import { flagEmoji } from '../lib/format'
import { groups, lookupAirport } from '../../engine/reference'
import type { CardContext, CardDef } from './registry'

const ACCENT      = '#12c08a'
const ACCENT_GRAD = 'linear-gradient(90deg, #12c08a, #3ad6c0)'
const ACCENT_SOFT = '#ddf7ee'

// Build a map: group name -> array of airports in that group
const groupByName = new Map<string, string[]>()
for (const g of groups) groupByName.set(g.name, g.airports)

function buildRows(model: NonNullable<CardContext['model']>, groupAirports: boolean): BarRow[] {
  return model.byAirport.map((a) => {
    const key = a.key

    if (groupAirports) {
      // key may be a group name (when grouping is on) — check if it matches
      const members = groupByName.get(key)
      if (members) {
        // it's a group — get flag from first resolved member
        const firstAirport = members.map((c) => lookupAirport(c)).find(Boolean)
        const flag = firstAirport?.country ? flagEmoji(firstAirport.country) : ''
        const codesStr = `(${members.join('/')})`
        return {
          label: `${flag} ${key}`,
          value: a.count,
          sub: codesStr,
        }
      }
    }

    // raw IATA code (no grouping, or key not a group name)
    const airport = lookupAirport(key)
    const flag = airport?.country ? flagEmoji(airport.country) : ''
    const label = airport ? `${flag} ${airport.municipality || key}` : `${flag} ${key}`
    return { label: label.trim(), value: a.count }
  })
}

export const airportsCard: CardDef = {
  id: 'airports',
  title: 'Most-visited airports',
  group: 'core',
  accent: ACCENT,
  icon: '📍',
  render: ({ model, settings }: CardContext) => {
    const rows = buildRows(model!, settings.groupAirports)
    return (
      <CardFrame title="Most-visited airports" eyebrow="Where you land" accent={ACCENT} accentGrad={ACCENT_GRAD} accentSoft={ACCENT_SOFT} icon="📍">
        <BarList rows={rows} max={10} formatValue={(n) => `${n}`} accent={ACCENT} accentGrad={ACCENT_GRAD} accentSoft={ACCENT_SOFT} />
      </CardFrame>
    )
  },
}
