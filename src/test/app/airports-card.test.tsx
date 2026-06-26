// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { airportsCard } from '../../app/cards/AirportsCard'
import { buildModel, DEFAULT_SETTINGS } from '../../engine'
import { REQUIRED_COLUMNS } from '../../engine/parse'

const csv = [REQUIRED_COLUMNS.join(','),
  '2018-01-01,AAL,1,DFW,AUS,,,,,false,,2018-01-01T09:00,,,,,,,,Boeing 737,,,,,,,,,,,',
  '2018-02-01,AAL,2,DAL,AUS,,,,,false,,2018-02-01T09:00,,,,,,,,Boeing 737,,,,,,,,,,,',
].join('\n')

describe('airportsCard', () => {
  it('shows Dallas group as a top airport when grouping is on', () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    render(<>{airportsCard.render({ model, settings: DEFAULT_SETTINGS })}</>)
    // Dallas group label includes flag + "Dallas"
    expect(screen.getByText(/Dallas/)).toBeInTheDocument()
    // Dallas group's member codes shown as sub "(DFW/DAL)"
    expect(screen.getByText('(DFW/DAL)')).toBeInTheDocument()
    // AUS is a single airport whose municipality is "Austin"
    expect(screen.getByText(/Austin/)).toBeInTheDocument()
  })
})
