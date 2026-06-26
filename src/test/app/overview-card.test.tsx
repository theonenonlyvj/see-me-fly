// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { overviewCard } from '../../app/cards/OverviewCard'
import { buildModel, DEFAULT_SETTINGS } from '../../engine'
import { REQUIRED_COLUMNS } from '../../engine/parse'

const csv = [REQUIRED_COLUMNS.join(','),
  '2018-01-01,AAL,1,DFW,AUS,,,,,false,,2018-01-01T09:00,,,,,,,,Boeing 737,,,,,,,,,,,',
  '2018-02-01,UAL,2,DFW,SFO,,,,,false,,2018-02-01T09:00,,,,,,,,Boeing 737,,,,,,,,,,,',
].join('\n')

describe('overviewCard', () => {
  it('renders the flight count', () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    render(<>{overviewCard.render({ model, settings: DEFAULT_SETTINGS })}</>)
    const flightsLabel = screen.getByText('Flights')
    expect(flightsLabel).toBeInTheDocument()
    expect(flightsLabel.previousElementSibling).toHaveTextContent('2')
  })
})
