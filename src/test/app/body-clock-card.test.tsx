// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { bodyClockCard } from '../../app/cards/BodyClockCard'
import { buildModel, DEFAULT_SETTINGS } from '../../engine'
import { REQUIRED_COLUMNS } from '../../engine/parse'
import type { Settings } from '../../engine'

// Local dep/arr times land in columns 11 (Gate Departure Scheduled) and 17 (Gate Arrival
// Scheduled) — the same idiom the When-You-Fly test uses — so depHourLocal/arrHourLocal
// resolve and the flights are placeable on the dial. One row with no times is unplaceable
// (skipped, must not crash).
function makeRow(date: string, from: string, to: string, dep: string, arr: string): string {
  const f = new Array<string>(REQUIRED_COLUMNS.length).fill('')
  f[0] = date
  f[1] = 'AAL'
  f[2] = '1'
  f[3] = from
  f[4] = to
  f[9] = 'false'
  f[11] = dep // Gate Departure (Scheduled) → depHourLocal
  f[17] = arr // Gate Arrival (Scheduled)   → arrHourLocal
  f[19] = 'Boeing 737'
  return f.join(',')
}

const csv = [
  REQUIRED_COLUMNS.join(','),
  makeRow('2019-05-01', 'DFW', 'LGA', '2019-05-01T06:00', '2019-05-01T10:15'), // 6am
  makeRow('2019-05-02', 'DFW', 'ORD', '2019-05-02T06:00', '2019-05-02T08:10'), // 6am
  makeRow('2019-05-03', 'DFW', 'MSP', '2019-05-03T06:00', '2019-05-03T08:20'), // 6am (modal)
  makeRow('2019-05-04', 'SFO', 'DFW', '2019-05-04T22:30', '2019-05-05T04:10'), // red-eye wrap
  makeRow('2019-05-05', 'DFW', 'AUS', '', ''), // no times → unplaceable
].join('\n')

const SETTINGS: Settings = { ...DEFAULT_SETTINGS, home: 'DFW' }

describe('bodyClockCard', () => {
  it('renders the dial without throwing and shows the header, legend, and honesty caption', () => {
    const model = buildModel(csv, SETTINGS, '2026-06-25')
    render(<>{bodyClockCard.render({ model, settings: SETTINGS })}</>)
    expect(screen.getByRole('heading', { name: 'The Body-Clock' })).toBeInTheDocument()
    expect(screen.getByText(/Circadian · 24-hour dial/i)).toBeInTheDocument()
    // east/west legend meaning is captioned
    expect(screen.getByText(/Flew east/i)).toBeInTheDocument()
    expect(screen.getByText(/Flew west/i)).toBeInTheDocument()
    // honesty note about tone-from-overlap
    expect(screen.getByText(/tone from real density, not fill/i)).toBeInTheDocument()
    // the modal-hour callout (three 6am departures → "6am, 3×")
    expect(screen.getByText(/You have departed at/i)).toBeInTheDocument()
    expect(screen.getByText(/6am/i)).toBeInTheDocument()
  })

  it('renders gracefully with an empty model (no flights, no crash)', () => {
    const empty = buildModel(REQUIRED_COLUMNS.join(','), SETTINGS, '2026-06-25')
    render(<>{bodyClockCard.render({ model: empty, settings: SETTINGS })}</>)
    expect(screen.getByRole('heading', { name: 'The Body-Clock' })).toBeInTheDocument()
  })

  it('has stable identity in the registry', () => {
    expect(bodyClockCard.id).toBe('bodyClock')
    expect(bodyClockCard.group).toBe('creative')
  })
})
