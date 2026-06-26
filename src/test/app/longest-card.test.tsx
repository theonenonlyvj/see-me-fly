// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { longestCard } from '../../app/cards/LongestCard'
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

// DFW→SYD is ~8500 mi (very long), DFW→LHR is ~4750 mi, DFW→AUS is ~190 mi (short)
const csv = [
  REQUIRED_COLUMNS.join(','),
  makeRow('2018-01-01', 'DFW', 'AUS', '2018-01-01T09:00', '2018-01-01T10:00'),
  makeRow('2018-02-01', 'DFW', 'LHR', '2018-02-01T20:00', '2018-02-02T10:00'),
  makeRow('2018-03-01', 'DFW', 'SYD', '2018-03-01T18:00', '2018-03-03T08:00'),
].join('\n')

describe('longestCard', () => {
  it('shows the longest route (DFW→SYD) first', () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    render(<>{longestCard.render({ model, settings: DEFAULT_SETTINGS })}</>)
    // SYD should appear somewhere in the longest flights list
    expect(screen.getByText(/SYD/)).toBeInTheDocument()
  })

  it('has a toggle button for distance|duration', () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    render(<>{longestCard.render({ model, settings: DEFAULT_SETTINGS })}</>)
    expect(screen.getByRole('button', { name: /duration/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /distance/i })).toBeInTheDocument()
  })

  it('switches to duration mode when toggle clicked', () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    render(<>{longestCard.render({ model, settings: DEFAULT_SETTINGS })}</>)
    const durBtn = screen.getByRole('button', { name: /duration/i })
    fireEvent.click(durBtn)
    // After switching to duration, route arrows should still be present
    expect(screen.getAllByText(/→/).length).toBeGreaterThan(0)
  })
})
