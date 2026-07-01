import type { ReactNode } from 'react'
import CardFrame from '../components/CardFrame'
import BodyClock, { type DialArc } from '../components/charts/BodyClock'
import PopoutExplorer from '../components/PopoutExplorer'
import { tzDirection, modalDepartureHour } from '../lib/body-clock'
import type { EnrichedFlight } from '../../engine'
import type { CardContext, CardDef } from './registry'

const ACCENT = 'var(--indigo)'
const ACCENT_GRAD = 'linear-gradient(90deg, var(--indigo), var(--magenta))'
const ACCENT_SOFT = 'color-mix(in srgb, var(--indigo) 12%, white)'

const R_IN = 76 // arc-band inner (a touch inside BodyClock's R_IN for margin)
const R_OUT = 126 // arc-band outer

/** Stable 0..1 from a flight id, so each arc gets a fixed band radius (no reshuffle). */
function jitter01(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 1000) / 1000
}

/**
 * Build the dial arcs from the flown flights. A flight is placeable only when BOTH
 * local hours are present; the rest are silently skipped (they can't sit on the dial).
 * Sweep = wall-clock hours from dep→arr (mod 24); a 0-hour wrap (dep==arr) gets a hair
 * of sweep so it still renders as a mark rather than a point.
 */
function buildArcs(flights: EnrichedFlight[]): DialArc[] {
  const arcs: DialArc[] = []
  for (const f of flights) {
    if (f.depHourLocal == null || f.arrHourLocal == null) continue
    let sweep = ((((f.arrHourLocal - f.depHourLocal) % 24) + 24) % 24)
    if (sweep === 0) sweep = 0.4
    const dir = tzDirection(f)
    // long haul: the wall clock (mod 24) advanced a lot, or true elapsed is big.
    const trueMin =
      f.depUtcMs != null && f.arrUtcMs != null
        ? (f.arrUtcMs - f.depUtcMs) / 60000
        : f.durationMin ?? 0
    const long = trueMin >= 360 || sweep >= 7
    const r = R_IN + jitter01(f.id) * (R_OUT - R_IN)
    arcs.push({ depHour: f.depHourLocal, sweep, dir, r, long })
  }
  return arcs
}

/** "6am" / "12pm" / "11pm" from a 0..23 hour. */
function fmtHour(h: number): string {
  const ampm = h < 12 ? 'am' : 'pm'
  const hr = h % 12 === 0 ? 12 : h % 12
  return `${hr}${ampm}`
}

function LegRow({ swatch, label, meta }: { swatch: ReactNode; label: string; meta?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12, color: 'var(--ink)', lineHeight: 1.15 }}>
      {swatch}
      <span>
        {label}
        {meta && <span style={{ color: 'var(--ink-2)' }}> — {meta}</span>}
      </span>
    </div>
  )
}

function Swatch({ background }: { background: string }) {
  return <span style={{ width: 24, height: 5, borderRadius: 3, background, flex: 'none' }} />
}

export const bodyClockCard: CardDef = {
  id: 'bodyClock',
  title: 'The Body-Clock',
  group: 'creative',
  accent: ACCENT,
  icon: '🌓',
  render: (ctx: CardContext) => {
    // A circadian portrait of the whole life aloft — read all-time flown flights.
    const flights = ctx.model!.flown
    const arcs = buildArcs(flights)
    const total = arcs.length
    const modal = modalDepartureHour(flights)

    const legendRows = (
      <>
        <LegRow swatch={<Swatch background="linear-gradient(90deg, var(--indigo), var(--magenta))" />} label="Flew east" meta="lose time" />
        <LegRow swatch={<Swatch background="linear-gradient(90deg, var(--sky), var(--lime))" />} label="Flew west" meta="gain time" />
        <LegRow swatch={<Swatch background="#c3c8d2" />} label="Same time zone" />
      </>
    )

    // Interactive pop-out: click an hour sector → the flights that departed that hour.
    const popBody = (
      <PopoutExplorer
        hint="Click an hour on the dial to see the flights that departed then."
        chart={(onPick) => (
          <div>
            <BodyClock arcs={arcs} total={total} modalHour={modal ? modal.hour : null}
              onPick={(hour) => {
                const hf = flights.filter((f) => f.depHourLocal === hour)
                onPick({ title: `Departures at ${fmtHour(hour)}`, subtitle: `${hf.length} flight${hf.length === 1 ? '' : 's'}`, flights: hf })
              }} />
            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 8, fontFamily: 'var(--font)' }}>{legendRows}</div>
          </div>
        )}
      />
    )

    return (
      <CardFrame
        title="The Body-Clock"
        eyebrow="Circadian · 24-hour dial"
        accent={ACCENT}
        accentGrad={ACCENT_GRAD}
        accentSoft={ACCENT_SOFT}
        icon="🌓"
        poppable
        popBody={popBody}
      >
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* the dial */}
          <div style={{ flex: '1 1 260px', minWidth: 240, maxWidth: 560 }}>
            <BodyClock arcs={arcs} total={total} modalHour={modal ? modal.hour : null} />
          </div>

          {/* callout + legend + honesty caption */}
          <div style={{ flex: '1 1 200px', minWidth: 190, maxWidth: 360, fontFamily: 'var(--font)' }}>
            {modal && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: 'var(--ink-2)', fontWeight: 600 }}>You have departed at</div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 40, lineHeight: 0.95, color: 'var(--ink)' }}>
                  <span style={{ color: 'var(--tangerine)' }}>{fmtHour(modal.hour)}</span>
                  {`, ${modal.count.toLocaleString('en-US')}×`}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-2)', marginTop: 5, lineHeight: 1.35 }}>
                  more take-offs than any other hour of the day (orange tick on the rim).
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              <LegRow swatch={<Swatch background="linear-gradient(90deg, var(--indigo), var(--magenta))" />} label="Flew east" meta="lose time" />
              <LegRow swatch={<Swatch background="linear-gradient(90deg, var(--sky), var(--lime))" />} label="Flew west" meta="gain time" />
              <LegRow swatch={<Swatch background="#c3c8d2" />} label="Same time zone" />
            </div>

            <div style={{ fontSize: 10.5, color: 'var(--ink-2)', lineHeight: 1.42 }}>
              Each thread is one flight, arced from local take-off to touch-down.{' '}
              <b style={{ color: 'var(--ink)', fontWeight: 600 }}>{total.toLocaleString('en-US')} flights</b>{' '}
              bloom into the hours this body has spent aloft. Hue = the direction the clock jumped
              (east loses, west gains); overlap darkens the busy hours — tone from real density, not fill.
            </div>
          </div>
        </div>
      </CardFrame>
    )
  },
}
