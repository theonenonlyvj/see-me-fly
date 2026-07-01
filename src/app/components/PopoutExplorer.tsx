import { useState } from 'react'
import type { ReactNode } from 'react'
import type { EnrichedFlight } from '../../engine'
import { fmtMiles, fmtDuration } from '../lib/format'
import { sortRecent } from '../lib/flight-filters'

/** A selection surfaced by clicking an element in a popped-out chart. */
export interface Pick {
  title: string
  subtitle?: string
  flights: EnrichedFlight[]
}

const LIST_CAP = 300

/** Compact, scrollable flight list for the pop-out detail panel. */
export function FlightMiniList({ pick }: { pick: Pick }) {
  const sorted = sortRecent(pick.flights)
  const shown = sorted.slice(0, LIST_CAP)
  return (
    <div>
      <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--ink)' }}>{pick.title}</div>
      <div style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 10 }}>
        {pick.subtitle ?? `${pick.flights.length.toLocaleString('en-US')} flight${pick.flights.length === 1 ? '' : 's'}`}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 420, overflow: 'auto' }}>
        {shown.map((f) => (
          <div key={f.id} style={{
            display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'baseline',
            padding: '7px 2px', borderBottom: '1px solid var(--hair-2)',
          }}>
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>
              <span style={{ fontWeight: 700 }}>{f.date}</span>
              <span style={{ color: 'var(--ink-2)' }}> · {f.fromCode} → {f.toCode}</span>
              {f.airlineName && f.airlineName !== 'Unknown airline' && <span style={{ color: 'var(--ink-2)' }}> · {f.airlineName}</span>}
            </span>
            <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ink-2)', fontWeight: 600, whiteSpace: 'nowrap', fontSize: 12.5 }}>
              {f.distanceMi != null ? fmtMiles(f.distanceMi) : fmtDuration(f.durationMin)}
            </span>
          </div>
        ))}
        {sorted.length > LIST_CAP && (
          <p style={{ color: 'var(--ink-2)', fontSize: 12, marginTop: 8 }}>Showing {LIST_CAP} of {sorted.length.toLocaleString('en-US')}.</p>
        )}
      </div>
    </div>
  )
}

/**
 * A two-pane pop-out: an interactive chart on the left and a live detail panel on the right
 * (drops below on narrow widths). `chart` receives an `onPick` callback — call it when an element
 * is clicked to feature that element's flights in the panel.
 */
export default function PopoutExplorer({ chart, hint }: {
  chart: (onPick: (p: Pick) => void) => ReactNode
  hint: string
}) {
  const [pick, setPick] = useState<Pick | null>(null)
  return (
    <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      <div style={{ flex: '2 1 540px', minWidth: 300 }}>{chart(setPick)}</div>
      <div style={{ flex: '1 1 280px', minWidth: 240, borderLeft: '1px solid var(--hair-2)', paddingLeft: 20 }}>
        {pick ? <FlightMiniList pick={pick} /> : (
          <div style={{ color: 'var(--ink-2)', fontSize: 13, padding: '8px 0', lineHeight: 1.5 }}>{hint}</div>
        )}
      </div>
    </div>
  )
}
