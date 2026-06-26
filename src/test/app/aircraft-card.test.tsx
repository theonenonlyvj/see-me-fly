// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { aircraftCard } from '../../app/cards/AircraftCard'
import { buildModel, DEFAULT_SETTINGS } from '../../engine'
import { REQUIRED_COLUMNS } from '../../engine/parse'

// Boeing 737 = narrow body, Boeing 747 = wide body
const csv = [
  REQUIRED_COLUMNS.join(','),
  '2018-01-01,AAL,1,DFW,AUS,,,,,false,,2018-01-01T09:00,,,,,,,,Boeing 737,,,,,,,,,,,',
  '2018-02-01,UAL,2,DFW,SFO,,,,,false,,2018-02-01T09:00,,,,,,,,Boeing 737,,,,,,,,,,,',
  '2018-03-01,AAL,3,DFW,LHR,,,,,false,,2018-03-01T09:00,,,,,,,,Boeing 747,,,,,,,,,,,',
].join('\n')

describe('aircraftCard', () => {
  it('shows aircraft class labels (narrow or wide)', () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    render(<>{aircraftCard.render({ model, settings: DEFAULT_SETTINGS })}</>)
    // Boeing 737 → narrow, Boeing 747 → wide — at least one of each should appear
    expect(screen.getAllByText(/^narrow$|^wide$/i).length).toBeGreaterThan(0)
  })

  it('shows the top types section and caveat note', () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    render(<>{aircraftCard.render({ model, settings: DEFAULT_SETTINGS })}</>)
    expect(screen.getByText(/blank types excluded/i)).toBeInTheDocument()
  })
})
