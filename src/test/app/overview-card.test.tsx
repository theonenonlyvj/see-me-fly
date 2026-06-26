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
  it('renders the flight count and stat labels', () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    render(<>{overviewCard.render({ model, settings: DEFAULT_SETTINGS })}</>)
    expect(screen.getByText('Flights')).toBeInTheDocument()
    // The hero number and stat labels are present
    expect(screen.getAllByText('2').length).toBeGreaterThan(0)
    // Stat grid labels are present
    expect(screen.getByText('Time in flight')).toBeInTheDocument()
    expect(screen.getByText('Unique airports')).toBeInTheDocument()
  })
})
