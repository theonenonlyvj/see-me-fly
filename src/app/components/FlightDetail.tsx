import { DateTime } from 'luxon'
import type { EnrichedFlight } from '../../engine'
import { fmtMiles, fmtDuration } from '../lib/format'

function localStamp(ms: number | null, tz: string | undefined): string {
  if (ms == null || !tz) return '—'
  const dt = DateTime.fromMillis(ms, { zone: tz })
  return dt.isValid ? dt.toFormat('HH:mm') : '—'
}

function Endpoint({ code, ap, label }: { code: string; ap: EnrichedFlight['from']; label: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-2)' }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 30, lineHeight: 1.05, color: 'var(--ink)' }}>{ap?.iata || code}</div>
      <div style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>{ap?.municipality || ap?.name || code}</div>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-2)' }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{value}</div>
    </div>
  )
}

export default function FlightDetail({ flight: f }: { flight: EnrichedFlight }) {
  const facts: { label: string; value: string }[] = []
  facts.push({ label: 'Date', value: f.date })
  if (f.airlineName) facts.push({ label: 'Airline', value: f.airlineName + (f.flightNumber ? ` ${f.airlineCode}${f.flightNumber}` : '') })
  facts.push({ label: 'Departs (local)', value: localStamp(f.depUtcMs, f.from?.tz) })
  facts.push({ label: 'Arrives (local)', value: localStamp(f.arrUtcMs, f.to?.tz) })
  if (f.distanceMi != null) facts.push({ label: 'Distance', value: fmtMiles(f.distanceMi) })
  facts.push({ label: 'Duration', value: fmtDuration(f.durationMin) })
  if (f.delayMin != null) facts.push({ label: 'Delay', value: f.delayMin > 0 ? `+${f.delayMin} min` : 'on time' })
  if (f.aircraftType) facts.push({ label: 'Aircraft', value: f.aircraftType })
  if (f.tail) facts.push({ label: 'Tail', value: f.tail })
  if (f.cabin) facts.push({ label: 'Cabin', value: f.cabin })
  if (f.seat) facts.push({ label: 'Seat', value: f.seat })
  if (f.diverted && f.intendedToCode) facts.push({ label: 'Diverted from', value: f.intendedToCode })

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 14, marginBottom: 22 }}>
        <Endpoint code={f.fromCode} ap={f.from} label="From" />
        <div style={{ fontSize: 22, color: 'var(--ink-2)' }}>→</div>
        <Endpoint code={f.toCode} ap={f.to} label="To" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 16 }}>
        {facts.map((x) => <Fact key={x.label} label={x.label} value={x.value} />)}
      </div>
      {f.notes && (
        <div style={{ marginTop: 18, fontSize: 13, color: 'var(--ink-2)', borderTop: '1px solid var(--hair-2)', paddingTop: 12 }}>
          {f.notes}
        </div>
      )}
    </div>
  )
}
