import CardFrame from '../components/CardFrame'
import { byWeekday, aircraftClassCounts, homeDistanceTiers } from '../../engine/stats'
import { displayEndpoint } from '../lib/places'
import type { CardContext, CardDef } from './registry'

const ACCENT = '#ff3d57'
const GRAD = 'linear-gradient(120deg, #ff3d57, #ff7a14 45%, #6a3cff)'
const SOFT = '#ffe8ec'

const CLASS_TRAIT: Record<string, string> = { wide: 'Widebody flyer', narrow: 'Narrowbody regular', regional: 'Regional-jet rider', prop: 'Propeller adventurer', unclassified: 'Mixed fleet' }

export const flightPersonalityCard: CardDef = {
  id: 'personality',
  title: 'Your flight personality',
  group: 'creative',
  accent: ACCENT,
  icon: '🪪',
  render: ({ model, settings }: CardContext) => {
    const scoped = model!.scoped
    const total = model!.totals.count
    const topAirline = model!.byAirline[0]
    const topAirport = model!.byAirport[0]
    const cls = aircraftClassCounts(scoped)[0]
    const wk = byWeekday(scoped)
    const wkTotal = wk.reduce((a, b) => a + b, 0)
    const weekdayShare = wkTotal > 0 ? wk.slice(0, 5).reduce((a, b) => a + b, 0) / wkTotal : 0
    const tiers = homeDistanceTiers(scoped, settings)
    const tierTotal = tiers.reduce((a, b) => a + b.count, 0)
    const intlShare = tierTotal > 0 ? (tiers.find((t) => t.tier === 'intercontinental')?.count ?? 0) / tierTotal : 0

    const persona = weekdayShare >= 0.6 && intlShare < 0.15 ? 'Business Commuter'
      : intlShare >= 0.25 ? 'Global Roamer'
      : weekdayShare >= 0.6 ? 'Road Warrior' : 'Frequent Flyer'
    const hub = topAirport ? displayEndpoint(topAirport.key) : null
    const headline = hub ? `${hub} ${persona}` : persona

    const traits: string[] = []
    traits.push(weekdayShare >= 0.65 ? 'Weekday commuter' : 'Flies any day')
    if (topAirline && total > 0 && topAirline.count / total >= 0.4) traits.push(`${topAirline.name} loyalist`)
    traits.push(intlShare >= 0.2 ? 'Globe-crosser' : 'Domestic regular')
    if (cls) traits.push(CLASS_TRAIT[cls.cls])

    return (
      <CardFrame title="Your flight personality" eyebrow="Who you are at 35,000 ft" accent={ACCENT} accentGrad={GRAD} accentSoft={SOFT} icon="🪪">
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 34, lineHeight: 1.04, letterSpacing: '-0.02em', background: GRAD, WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', color: 'transparent' }}>
          {headline}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 18 }}>
          {traits.map((t) => (
            <span key={t} style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', background: SOFT, border: '1px solid color-mix(in srgb, ' + ACCENT + ' 22%, transparent)', borderRadius: 999, padding: '5px 12px' }}>{t}</span>
          ))}
        </div>
        <p style={{ marginTop: 16, fontSize: 11.5, color: 'var(--ink-2)', fontStyle: 'italic' }}>
          {Math.round(weekdayShare * 100)}% weekday flying · {Math.round(intlShare * 100)}% intercontinental{topAirline ? ` · ${Math.round((topAirline.count / Math.max(total, 1)) * 100)}% on ${topAirline.name}` : ''}.
        </p>
      </CardFrame>
    )
  },
}
