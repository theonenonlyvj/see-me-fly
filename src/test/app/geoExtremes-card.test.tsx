// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { geoExtremesCard } from '../../app/cards/GeoExtremesCard'
import { buildModel, DEFAULT_SETTINGS } from '../../engine'
import { REQUIRED_COLUMNS } from '../../engine/parse'

// Default home is now UNSET (friend-ready), so per-base / farthest-from-home tests
// must opt into a home explicitly. DFW is the long-standing fixture home.
const DFW_SETTINGS = { ...DEFAULT_SETTINGS, home: 'DFW' }

function makeRow(date: string, from: string, to: string): string {
  const fields = new Array<string>(REQUIRED_COLUMNS.length).fill('')
  fields[0]  = date
  fields[1]  = 'AAL'
  fields[2]  = '1'
  fields[3]  = from
  fields[4]  = to
  fields[9]  = 'false'
  return fields.join(',')
}

// SYD (Sydney, Australia) is very far from DFW (home), and far south
// LHR (London Heathrow) is far north
// DFW is in Texas
const csv = [
  REQUIRED_COLUMNS.join(','),
  makeRow('2018-01-01', 'DFW', 'LHR'),
  makeRow('2018-02-01', 'DFW', 'SYD'),
  makeRow('2018-03-01', 'DFW', 'AUS'),
].join('\n')

describe('geoExtremesCard', () => {
  it('shows a single furthest-from-home record (SYD, farthest from any home)', () => {
    const model = buildModel(csv, DFW_SETTINGS, '2026-06-25')
    render(<>{geoExtremesCard.render({ model, settings: DFW_SETTINGS })}</>)
    expect(screen.getByText(/furthest from home/i)).toBeInTheDocument()
    // SYD (Sydney) is the farthest reach from home; shown with its mileage, no per-base rows/notes.
    const section = screen.getByText(/furthest from home/i).parentElement!
    expect(section.textContent).toMatch(/SYD/)
    expect(section.textContent).toMatch(/mi/)
  })

  it('shows northernmost label (global block)', () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    render(<>{geoExtremesCard.render({ model, settings: DEFAULT_SETTINGS })}</>)
    expect(screen.getByText(/northernmost/i)).toBeInTheDocument()
  })

  it('shows southernmost label (global block)', () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    render(<>{geoExtremesCard.render({ model, settings: DEFAULT_SETTINGS })}</>)
    expect(screen.getByText(/southernmost/i)).toBeInTheDocument()
  })

  it('clicking a farthest-from-home row opens the whole TRIP that reached the farthest airport', () => {
    const model = buildModel(csv, DFW_SETTINGS, '2026-06-25')
    const opened: { title: string; flights: typeof model.flown }[] = []
    const overlay = {
      openFlights: (title: string, flights: typeof model.flown) => opened.push({ title, flights }),
    } as never
    render(<>{geoExtremesCard.render({ model, settings: DFW_SETTINGS, overlay })}</>)
    // The single furthest-from-home row (under its header) reaches SYD.
    const section = screen.getByText(/furthest from home/i).parentElement!
    const baseRow = section.querySelector('[role="button"]')! as HTMLElement
    expect(baseRow.textContent).toMatch(/SYD/)
    baseRow.click()
    expect(opened).toHaveLength(1)
    // The single DFW→SYD flight is its own (estimated-end) trip; opening the trip shows that leg.
    expect(opened[0].flights.some((f) => f.toCode === 'SYD')).toBe(true)
    // Titled "Trip to <farthest> · <month year>".
    expect(opened[0].title).toMatch(/Trip to SYD/)
    expect(opened[0].title).toMatch(/2018/)
  })

  it('opens the FULL multi-leg trip (not just the record leg) when the farthest is mid-trip', () => {
    // A real round trip: DFW→SYD→DFW. SYD is the farthest; clicking the row should open BOTH legs.
    const roundCsv = [
      REQUIRED_COLUMNS.join(','),
      makeRow('2019-05-01', 'DFW', 'SYD'),
      makeRow('2019-05-10', 'SYD', 'DFW'),
    ].join('\n')
    const model = buildModel(roundCsv, DFW_SETTINGS, '2026-06-25')
    const opened: { title: string; flights: typeof model.flown }[] = []
    const overlay = { openFlights: (title: string, flights: typeof model.flown) => opened.push({ title, flights }) } as never
    render(<>{geoExtremesCard.render({ model, settings: DFW_SETTINGS, overlay })}</>)
    const section = screen.getByText(/furthest from home/i).parentElement!
    const baseRow = section.querySelector('[role="button"]')! as HTMLElement
    baseRow.click()
    expect(opened).toHaveLength(1)
    // The whole trip = both legs (the outbound record leg AND the return), not just DFW→SYD.
    expect(opened[0].flights).toHaveLength(2)
    expect(opened[0].title).toMatch(/Trip to SYD/)
  })

  it('renders the global block but NO per-base section when there is no home', () => {
    const noHome = { ...DEFAULT_SETTINGS, home: null, homeHistory: [] }
    const model = buildModel(csv, noHome, '2026-06-25')
    render(<>{geoExtremesCard.render({ model, settings: noHome })}</>)
    expect(screen.getByText(/northernmost/i)).toBeInTheDocument()
    expect(screen.queryByText(/furthest from home/i)).not.toBeInTheDocument()
  })

  it('renders empty-state when no resolved airports', () => {
    const emptyCSV = [REQUIRED_COLUMNS.join(',')].join('\n')
    const model = buildModel(emptyCSV, DEFAULT_SETTINGS, '2026-06-25')
    render(<>{geoExtremesCard.render({ model, settings: DEFAULT_SETTINGS })}</>)
    expect(screen.getByText(/no data/i)).toBeInTheDocument()
  })
})
