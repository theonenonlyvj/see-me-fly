// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { whenYouFlyCard } from '../../app/cards/WhenYouFlyCard'
import { buildModel, DEFAULT_SETTINGS } from '../../engine'
import { REQUIRED_COLUMNS } from '../../engine/parse'

function makeRow(date: string, from: string, to: string, depTime: string, arrTime: string): string {
  const fields = new Array<string>(REQUIRED_COLUMNS.length).fill('')
  fields[0]  = date
  fields[1]  = 'AAL'
  fields[2]  = '1'
  fields[3]  = from
  fields[4]  = to
  fields[9]  = 'false'
  // index 11 = Gate Departure (Scheduled), index 17 = Gate Arrival (Scheduled)
  fields[11] = depTime
  fields[17] = arrTime
  return fields.join(',')
}

// Flights across two months with specific dep/arr hours
const csv = [
  REQUIRED_COLUMNS.join(','),
  makeRow('2023-01-10', 'DFW', 'LAX', '2023-01-10T08:00', '2023-01-10T10:00'),
  makeRow('2023-01-20', 'LAX', 'DFW', '2023-01-20T14:00', '2023-01-20T19:00'),
  makeRow('2023-03-05', 'DFW', 'ORD', '2023-03-05T06:00', '2023-03-05T08:30'),
  makeRow('2023-03-15', 'ORD', 'DFW', '2023-03-15T16:00', '2023-03-15T18:00'),
].join('\n')

describe('whenYouFlyCard', () => {
  it('renders "Departures" label', () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    render(<>{whenYouFlyCard.render({ model, settings: DEFAULT_SETTINGS })}</>)
    expect(screen.getByText(/departures/i)).toBeInTheDocument()
  })

  it('renders "Arrivals" label', () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    render(<>{whenYouFlyCard.render({ model, settings: DEFAULT_SETTINGS })}</>)
    expect(screen.getByText(/arrivals/i)).toBeInTheDocument()
  })

  it('renders 24 bars for each histogram (48 total)', () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    const { container } = render(<>{whenYouFlyCard.render({ model, settings: DEFAULT_SETTINGS })}</>)
    const bars = container.querySelectorAll('[data-bar]')
    expect(bars.length).toBe(48)
  })
})
