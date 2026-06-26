// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { shortestCard } from '../../app/cards/ShortestCard'
import { buildModel, DEFAULT_SETTINGS } from '../../engine'
import { REQUIRED_COLUMNS } from '../../engine/parse'

function makeRow(date: string, from: string, to: string, takeoffActual: string, landingActual: string): string {
  const fields = new Array<string>(REQUIRED_COLUMNS.length).fill('')
  fields[0]  = date
  fields[1]  = 'AAL'
  fields[2]  = '1'
  fields[3]  = from
  fields[4]  = to
  fields[9]  = 'false'
  fields[14] = takeoffActual  // Take off (Actual)
  fields[16] = landingActual  // Landing (Actual)
  return fields.join(',')
}

// DFW→AUS is ~190 mi (short), DFW→LHR is ~4750 mi (long)
const csv = [
  REQUIRED_COLUMNS.join(','),
  makeRow('2018-01-01', 'DFW', 'AUS', '2018-01-01T09:00', '2018-01-01T10:00'),
  makeRow('2018-02-01', 'DFW', 'SFO', '2018-02-01T09:00', '2018-02-01T13:00'),
  makeRow('2018-03-01', 'DFW', 'LHR', '2018-03-01T20:00', '2018-03-02T10:00'),
].join('\n')

describe('shortestCard', () => {
  it('shows a route string for the shortest flight', () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    render(<>{shortestCard.render({ model, settings: DEFAULT_SETTINGS })}</>)
    // DFW→AUS should be shortest by distance
    expect(screen.getByText(/DFW.*AUS|AUS.*DFW/)).toBeInTheDocument()
  })

  it('has a toggle button for distance|duration', () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    render(<>{shortestCard.render({ model, settings: DEFAULT_SETTINGS })}</>)
    expect(screen.getByRole('button', { name: /duration/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /distance/i })).toBeInTheDocument()
  })

  it('switches to duration mode when toggle clicked', () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    render(<>{shortestCard.render({ model, settings: DEFAULT_SETTINGS })}</>)
    const durBtn = screen.getByRole('button', { name: /duration/i })
    fireEvent.click(durBtn)
    // After switching to duration, should still show a route
    expect(screen.getAllByText(/→/).length).toBeGreaterThan(0)
  })
})
