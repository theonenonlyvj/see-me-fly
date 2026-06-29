// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { tripsCard } from '../../app/cards/TripsCard'
import { tripsExplorerCard } from '../../app/cards/TripsExplorerCard'
import { reconstructTrips } from '../../engine/stats'
import { buildModel, DEFAULT_SETTINGS } from '../../engine'
import { REQUIRED_COLUMNS } from '../../engine/parse'

function makeRow(date: string, from: string, to: string): string {
  const fields = new Array<string>(REQUIRED_COLUMNS.length).fill('')
  fields[0] = date
  fields[1] = 'AAL'
  fields[2] = '1'
  fields[3] = from
  fields[4] = to
  fields[9] = 'false'
  return fields.join(',')
}

// Home = DFW. An outbound DFW→AUS with NO recorded return leaves an open trip whose END boundary
// the engine must INFER → that trip carries `estimated:{boundary:'end'}`. A normal round-trip
// (DFW→AUS→DFW) is NOT estimated.
const csv = [
  REQUIRED_COLUMNS.join(','),
  // estimated-end trip: out, never came back
  makeRow('2019-03-10', 'DFW', 'AUS'),
  // a clean round trip later (not estimated)
  makeRow('2020-06-15', 'DFW', 'LAX'),
  makeRow('2020-06-20', 'LAX', 'DFW'),
].join('\n')

const settings = { ...DEFAULT_SETTINGS, home: 'DFW' }

describe('Trip.estimated surfacing (SHOULD-FIX 4)', () => {
  it('the engine actually produces at least one estimated trip for this fixture (guard)', () => {
    const model = buildModel(csv, settings, '2026-06-25')
    const trips = reconstructTrips(model.flown, settings)
    expect(trips.some((t) => t.estimated)).toBe(true)
  })

  it('TripsCard renders an "estimated" badge on inferred-boundary trips', () => {
    const model = buildModel(csv, settings, '2026-06-25')
    render(<>{tripsCard.render({ model, settings })}</>)
    // a visible badge labelled estimated
    expect(screen.getAllByText(/estimated/i).length).toBeGreaterThan(0)
  })

  it('TripsExplorerCard renders an "estimated" badge too', () => {
    const model = buildModel(csv, settings, '2026-06-25')
    render(<>{tripsExplorerCard.render({ model, settings })}</>)
    expect(screen.getAllByText(/estimated/i).length).toBeGreaterThan(0)
  })

  it('TripsExplorerCard has a "needs a link" filter that narrows to estimated trips only', () => {
    const model = buildModel(csv, settings, '2026-06-25')
    render(<>{tripsExplorerCard.render({ model, settings })}</>)
    // Before filtering: both trips show (2 rows worth of route labels).
    expect(screen.getByText(/DFW-LAX-DFW/)).toBeInTheDocument()
    expect(screen.getByText(/DFW-AUS/)).toBeInTheDocument()
    // Toggle the "needs a link" filter.
    fireEvent.click(screen.getByRole('button', { name: /needs a link/i }))
    // Now only the estimated trip (DFW-AUS) remains; the clean round trip is gone.
    expect(screen.getByText(/DFW-AUS/)).toBeInTheDocument()
    expect(screen.queryByText(/DFW-LAX-DFW/)).toBeNull()
  })
})
