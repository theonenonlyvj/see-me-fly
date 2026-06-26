import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { EnrichedFlight } from '../../engine'
import { fmtDuration, fmtMiles } from '../lib/format'
import { sortRecent } from '../lib/flight-filters'
import FlightDetail from './FlightDetail'

export interface OverlayApi {
  openFlights: (title: string, flights: EnrichedFlight[], subtitle?: string) => void
  openFlight: (flight: EnrichedFlight) => void
}

const NOOP: OverlayApi = { openFlights: () => {}, openFlight: () => {} }
const Ctx = createContext<OverlayApi>(NOOP)
export function useOverlay(): OverlayApi { return useContext(Ctx) }

type Overlay =
  | { kind: 'flights'; title: string; subtitle?: string; flights: EnrichedFlight[] }
  | { kind: 'flight'; flight: EnrichedFlight }

const LIST_CAP = 500

function routeStr(f: EnrichedFlight): string {
  return `${f.fromCode} → ${f.toCode}`
}

function FlightsBody({ flights, onOpenFlight }: { flights: EnrichedFlight[]; onOpenFlight: (f: EnrichedFlight) => void }) {
  if (flights.length === 0) return <p style={{ color: 'var(--ink-2)' }}>No flights match this selection.</p>
  const sorted = sortRecent(flights)
  const shown = sorted.slice(0, LIST_CAP)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {shown.map((f) => (
        <button
          key={f.id}
          onClick={() => onOpenFlight(f)}
          style={{
            display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'baseline',
            width: '100%', textAlign: 'left', cursor: 'pointer',
            background: 'transparent', border: 'none', borderBottom: '1px solid var(--hair-2)',
            padding: '9px 4px', font: 'inherit', color: 'var(--ink)',
          }}
        >
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <span style={{ fontWeight: 700 }}>{f.date}</span>
            <span style={{ color: 'var(--ink-2)' }}> · {routeStr(f)}</span>
            {f.airlineName && f.airlineName !== 'Unknown airline' && <span style={{ color: 'var(--ink-2)' }}> · {f.airlineName}</span>}
          </span>
          <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ink-2)', fontWeight: 600, whiteSpace: 'nowrap' }}>
            {f.distanceMi != null ? fmtMiles(f.distanceMi) : fmtDuration(f.durationMin)}
          </span>
        </button>
      ))}
      {sorted.length > LIST_CAP && (
        <p style={{ color: 'var(--ink-2)', fontSize: 12.5, marginTop: 10 }}>
          Showing the {LIST_CAP} most recent of {sorted.length.toLocaleString('en-US')} — narrow the view (scope/settings) to see more.
        </p>
      )}
    </div>
  )
}

function Panel({ title, subtitle, onClose, onBack, children }: {
  title: string
  subtitle?: string
  onClose: () => void
  onBack?: () => void
  children: ReactNode
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => e.stopPropagation()}
      style={{
        width: 'min(680px, 94vw)', maxHeight: '86vh', display: 'flex', flexDirection: 'column',
        background: '#fff', borderRadius: 20, overflow: 'hidden',
        boxShadow: '0 30px 80px -20px rgba(0,0,0,0.45), 0 0 0 1px rgba(0,0,0,0.05)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px', borderBottom: '1px solid var(--hair-2)' }}>
        {onBack && (
          <button onClick={onBack} aria-label="Back" style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--ink-2)', padding: 4 }}>‹</button>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
          {subtitle && <div style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>{subtitle}</div>}
        </div>
        <button onClick={onClose} aria-label="Close" style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--ink-2)', padding: 4 }}>✕</button>
      </div>
      <div style={{ overflow: 'auto', padding: '18px 20px' }}>
        {children}
      </div>
    </div>
  )
}

export function OverlayProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<Overlay[]>([])

  const openFlights = useCallback((title: string, flights: EnrichedFlight[], subtitle?: string) => {
    setStack((s) => [...s, { kind: 'flights', title, flights, subtitle }])
  }, [])
  const openFlight = useCallback((flight: EnrichedFlight) => {
    setStack((s) => [...s, { kind: 'flight', flight }])
  }, [])
  const pop = useCallback(() => setStack((s) => s.slice(0, -1)), [])
  const closeAll = useCallback(() => setStack([]), [])

  const hasOverlay = stack.length > 0
  useEffect(() => {
    if (!hasOverlay) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') pop() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hasOverlay, pop])

  const top = stack[stack.length - 1]

  return (
    <Ctx.Provider value={{ openFlights, openFlight }}>
      {children}
      {top && (
        <div
          onClick={pop}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(20, 16, 24, 0.42)', backdropFilter: 'blur(2px)',
            display: 'grid', placeItems: 'center', padding: 20,
          }}
        >
          {top.kind === 'flights' ? (
            <Panel
              title={top.title}
              subtitle={top.subtitle ?? `${top.flights.length.toLocaleString('en-US')} flight${top.flights.length === 1 ? '' : 's'}`}
              onClose={closeAll}
              onBack={stack.length > 1 ? pop : undefined}
            >
              <FlightsBody flights={top.flights} onOpenFlight={openFlight} />
            </Panel>
          ) : (
            <Panel
              title={`${top.flight.fromCode} → ${top.flight.toCode}`}
              subtitle={top.flight.date}
              onClose={closeAll}
              onBack={stack.length > 1 ? pop : undefined}
            >
              <FlightDetail flight={top.flight} />
            </Panel>
          )}
        </div>
      )}
    </Ctx.Provider>
  )
}
