import CardFrame from '../components/CardFrame'
import StreamGraph, { type StreamLayer, type StreamHome } from '../components/charts/StreamGraph'
import PopoutExplorer from '../components/PopoutExplorer'
import { airlineByYearDetailed } from '../../engine/stats'
import { byAirline } from '../../engine/aggregate'
import { airlineColor } from '../../engine/airline-colors'
import { effectiveAirline } from '../../engine/airline-history'
import { sanitizeHomeHistory } from '../../engine/home'
import { displayEndpoint } from '../lib/places'
import type { CardContext, CardDef } from './registry'

const ACCENT = 'var(--coral)'
const ACCENT_GRAD = 'linear-gradient(110deg, #ff3d57, #ff7a14, #ff2fa8, #6a3cff, #1aa9ff)'
const ACCENT_SOFT = 'color-mix(in srgb, var(--coral) 12%, white)'

// Fallback Pop hues (by rank) for carriers without a brand color.
const CARRIER_COLORS = ['#ff3d57', '#1aa9ff', '#6a3cff', '#ff7a14', '#12c08a', '#ff2fa8']
const OTHER_COLOR = 'var(--ink-2)'
const FEATURED_N = 6

export const allegianceCard: CardDef = {
  id: 'allegiance',
  title: '13 years of who flew you',
  group: 'creative',
  accent: ACCENT,
  icon: '🌊',
  render: ({ model, settings }: CardContext) => {
    // Life portrait → ALL-TIME flights. Allegiance is brand loyalty, so always roll an acquired
    // carrier into its survivor (US Airways → American) regardless of the global setting.
    const flights = model!.flown
    const mergeDefunct = true

    const overall = byAirline(flights, mergeDefunct)
    const featured = overall.slice(0, FEATURED_N)
    const featuredNames = new Set(featured.map((a) => a.name))
    const colorOf = new Map(featured.map((a, i) => [a.name, airlineColor(a.airlineCode, CARRIER_COLORS[i % CARRIER_COLORS.length])]))
    const perYear = airlineByYearDetailed(flights, mergeDefunct)

    if (perYear.length === 0) {
      return (
        <CardFrame title="13 years of who flew you" eyebrow="Allegiance · by year" accent={ACCENT} accentGrad={ACCENT_GRAD} accentSoft={ACCENT_SOFT} icon="🌊" poppable>
          <p style={{ color: 'var(--ink-2)' }}>No airline history in this view.</p>
        </CardFrame>
      )
    }

    // Contiguous years so a gap year reads as an honest pinch, not a skipped column.
    const minY = perYear[0].year
    const maxY = perYear[perYear.length - 1].year
    const years: number[] = []
    for (let y = minY; y <= maxY; y++) years.push(y)
    const rowByYear = new Map(perYear.map((r) => [r.year, r]))
    const countAt = (name: string, y: number): number => rowByYear.get(y)?.counts.find((c) => c.name === name)?.n ?? 0

    const featuredLayers: StreamLayer[] = featured.map((a) => ({
      key: a.airlineCode || a.name,
      label: a.name,
      color: colorOf.get(a.name)!,
      counts: years.map((y) => countAt(a.name, y)),
      featured: true,
    }))
    const otherCounts = years.map((y) => {
      const row = rowByYear.get(y)
      if (!row) return 0
      return row.counts.reduce((s, c) => s + (featuredNames.has(c.name) ? 0 : c.n), 0)
    })
    const hasOther = otherCounts.some((c) => c > 0)
    const otherLayer: StreamLayer = { key: 'other', label: 'Other', color: OTHER_COLOR, counts: otherCounts, featured: false }
    // Draw Other FIRST (outer muted envelope), featured carriers atop it.
    const layers: StreamLayer[] = hasOther ? [otherLayer, ...featuredLayers] : featuredLayers
    const totals = years.map((y) => rowByYear.get(y)?.total ?? 0)

    // Home-move hairlines from the era timeline (drop the first era's start = the record's beginning).
    const eras = sanitizeHomeHistory(settings.homeHistory)
    const homes: StreamHome[] = eras.slice(1).map((era) => ({ date: era.start, label: displayEndpoint(era.airports[0]) }))

    const legend = [
      ...featured.map((a) => ({ label: a.name, color: colorOf.get(a.name)! })),
      ...(hasOther ? [{ label: 'Other', color: '#c9c5bc' }] : []),
    ]
    const legendEl = (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginTop: 14 }}>
        {legend.map((row) => (
          <span key={row.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, color: 'var(--ink-2)' }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: row.color, flexShrink: 0 }} />{row.label}
          </span>
        ))}
      </div>
    )

    // Resolve a clicked carrier band → every flight you flew on that carrier (Other = all non-featured).
    const resolveLayer = (L: StreamLayer) => {
      const ff = L.key === 'other'
        ? flights.filter((f) => { const n = effectiveAirline(f, mergeDefunct).name; return n !== 'Unknown airline' && !featuredNames.has(n) })
        : flights.filter((f) => effectiveAirline(f, mergeDefunct).name === L.label)
      return { title: L.label, subtitle: `${ff.length} flight${ff.length === 1 ? '' : 's'}`, flights: ff }
    }

    const popBody = (
      <PopoutExplorer
        hint="Click a carrier's band to see every flight you flew on them."
        chart={(onPick) => (
          <div>
            <StreamGraph years={years} layers={layers} totals={totals} homes={homes} onPick={(L) => onPick(resolveLayer(L))} />
            {legendEl}
          </div>
        )}
      />
    )

    return (
      <CardFrame title="13 years of who flew you" eyebrow="Allegiance · by year" accent={ACCENT} accentGrad={ACCENT_GRAD} accentSoft={ACCENT_SOFT} icon="🌊" poppable popBody={popBody}>
        <StreamGraph years={years} layers={layers} totals={totals} homes={homes} />
        {legendEl}
        <p style={{ marginTop: 8, fontSize: 11.5, color: 'var(--ink-2)', fontStyle: 'italic' }}>
          Band thickness = flights that year; smoothed between years. Top strip keeps each year&apos;s true total honest.
        </p>
      </CardFrame>
    )
  },
}
