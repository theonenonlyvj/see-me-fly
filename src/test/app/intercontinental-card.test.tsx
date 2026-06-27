// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { intercontinentalCard } from '../../app/cards/IntercontinentalCard'
import { buildModel, DEFAULT_SETTINGS } from '../../engine'
import { REQUIRED_COLUMNS } from '../../engine/parse'

afterEach(cleanup)

// DFW→LHR: US (NA) → UK (EU) = intercontinental
// DFW→AUS: intra-state, should NOT appear
const csv = [
  REQUIRED_COLUMNS.join(','),
  '2018-01-01,AAL,1,DFW,LHR,,,,,false,,2018-01-01T09:00,,,,,,,,Boeing 747,,,,,,,,,,,',
  '2018-02-01,AAL,2,DFW,LHR,,,,,false,,2018-02-01T09:00,,,,,,,,Boeing 747,,,,,,,,,,,',
  '2018-03-01,AAL,3,DFW,AUS,,,,,false,,2018-03-01T09:00,,,,,,,,Boeing 737,,,,,,,,,,,',
].join('\n')

describe('intercontinentalCard', () => {
  it('groups routes by continent pair', () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    render(<>{intercontinentalCard.render({ model, settings: DEFAULT_SETTINGS })}</>)
    expect(screen.getByText(/Europe ↔ North America/)).toBeInTheDocument()
  })

  it('expands a continent pair to reveal its routes', async () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    render(<>{intercontinentalCard.render({ model, settings: DEFAULT_SETTINGS })}</>)
    expect(screen.queryByText(/London/)).not.toBeInTheDocument() // collapsed
    await userEvent.click(screen.getByRole('button', { expanded: false }))
    expect(screen.getByText(/London/)).toBeInTheDocument()
  })

  it('renders card title "Intercontinental"', () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    render(<>{intercontinentalCard.render({ model, settings: DEFAULT_SETTINGS })}</>)
    expect(screen.getByText('Intercontinental')).toBeInTheDocument()
  })
})
