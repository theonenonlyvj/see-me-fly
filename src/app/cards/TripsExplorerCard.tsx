import { useState } from 'react'
import CardFrame from '../components/CardFrame'
import BarList from '../components/charts/BarList'
import type { BarRow } from '../components/charts/BarList'
import { reconstructTrips, type Trip } from '../../engine/stats'
import type { CardContext, CardDef } from './registry'

const ACCENT = '#0891b2'
const GRAD = 'linear-gradient(90deg, #0891b2, #67e8f9)'
const SOFT = '#d8f3fb'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const when = (t: Trip) => `${MONTHS[Number(t.departDate.slice(5, 7)) - 1] ?? ''} ${t.departDate.slice(0, 4)}`
const fmtMi = (n: number) => Math.round(n).toLocaleString()
const tripMiles = (t: Trip) => t.flights.reduce((s, f) => s + (f.distanceMi ?? 0), 0)

// Readable routing: one airport per stop; "/" marks a ground switch (arrived LGA, left from JFK).
export const routePath = (t: Trip): string => {
  const fs = t.flights
  if (fs.length === 0) return 'local'
  const parts = [fs[0].fromCode]
  for (let i = 0; i < fs.length; i++) {
    const arr = fs[i].toCode
    const nextDep = i < fs.length - 1 ? fs[i + 1].fromCode : null
    parts.push(nextDep && nextDep !== arr ? `${arr}/${nextDep}` : arr)
  }
  return parts.join('-')
}

type Sort = 'recent' | 'nights' | 'legs' | 'distance'
const SORTS: [Sort, string, (t: Trip) => number, (t: Trip) => string][] = [
  ['recent', 'Recent', (t) => -Date.parse(t.departDate), (t) => `${t.nights} night${t.nights === 1 ? '' : 's'}`],
  ['nights', 'Most nights', (t) => -t.nights, (t) => `${t.nights} night${t.nights === 1 ? '' : 's'}`],
  ['legs', 'Most legs', (t) => -t.flights.length, (t) => `${t.flights.length} legs`],
  ['distance', 'Farthest', (t) => -tripMiles(t), (t) => `${fmtMi(tripMiles(t))} mi`],
]

function TripsExplorerView({ model, settings, overlay }: CardContext) {
  const [sort, setSort] = useState<Sort>('nights')
  const cfg = SORTS.find((s) => s[0] === sort)!
  const trips = reconstructTrips(model!.scoped, settings).slice().sort((a, b) => cfg[2](a) - cfg[2](b))
  const valueOf = sort === 'legs' ? (t: Trip) => t.flights.length : sort === 'nights' ? (t: Trip) => t.nights : sort === 'distance' ? tripMiles : (t: Trip) => t.flights.length
  const rows: BarRow[] = trips.map((t, i) => ({ label: `${when(t)} · ${routePath(t)}`, value: valueOf(t), sub: cfg[3](t), id: String(i) }))
  return (
    <CardFrame title="Trips explorer" eyebrow="Sort your journeys" accent={ACCENT} accentGrad={GRAD} accentSoft={SOFT} icon="🧭">
      {!settings.home ? (
        <p style={{ color: 'var(--ink-2)' }}>Set a home airport in Settings to reconstruct your trips.</p>
      ) : rows.length === 0 ? (
        <p style={{ color: 'var(--ink-2)' }}>No trips in this view.</p>
      ) : (
        <>
          <div style={{ display: 'inline-flex', padding: 3, gap: 2, marginBottom: 14, background: SOFT, borderRadius: 12, border: `1px solid color-mix(in srgb, ${ACCENT} 24%, transparent)` }}>
            {SORTS.map(([k, lbl]) => (
              <button key={k} onClick={() => setSort(k)}
                style={{ fontFamily: 'var(--font)', fontSize: 12, fontWeight: 800, border: 'none', cursor: 'pointer', padding: '6px 12px', borderRadius: 9, color: sort === k ? '#fff' : 'var(--ink)', background: sort === k ? ACCENT : 'transparent' }}>
                {lbl}
              </button>
            ))}
          </div>
          <BarList rows={rows} max={10} seeAllTitle="Trips explorer" formatValue={(n) => sort === 'legs' ? `${n} legs` : sort === 'distance' ? `${fmtMi(n)} mi` : `${n}`}
            accent={ACCENT} accentGrad={GRAD} accentSoft={SOFT}
            onRowClick={(row) => { const t = trips[Number(row.id)]; if (t) overlay?.openFlights(`Trip · ${when(t)} · ${routePath(t)}`, t.flights) }} />
          <p style={{ marginTop: 14, fontSize: 11.5, color: 'var(--ink-2)', fontStyle: 'italic' }}>Sort and tap a trip to see it on the map.</p>
        </>
      )}
    </CardFrame>
  )
}

export const tripsExplorerCard: CardDef = {
  id: 'tripsExplorer',
  title: 'Trips explorer',
  group: 'creative',
  accent: ACCENT,
  icon: '🧭',
  render: (ctx: CardContext) => <TripsExplorerView {...ctx} />,
}
