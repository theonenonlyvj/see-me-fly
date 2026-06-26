// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { distanceCard } from '../../app/cards/DistanceCard'
import { buildModel, DEFAULT_SETTINGS } from '../../engine'
import { REQUIRED_COLUMNS } from '../../engine/parse'

const csv = [REQUIRED_COLUMNS.join(','),
  '2018-01-01,AAL,1,DFW,AUS,,,,,false,,2018-01-01T09:00,,,,,,,,Boeing 737,,,,,,,,,,,', // ~190mi <300
  '2018-02-01,AAL,2,DFW,LHR,,,,,false,,2018-02-01T09:00,,,,,,,,Boeing 777,,,,,,,,,,,', // ~4700mi
].join('\n')

describe('distanceCard', () => {
  it('renders the <300 band with a count', () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    render(<>{distanceCard.render({ model, settings: DEFAULT_SETTINGS })}</>)
    expect(screen.getByText(/<300 mi/)).toBeInTheDocument()
  })
})
