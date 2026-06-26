// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { countriesCard } from '../../app/cards/CountriesCard'

afterEach(cleanup)
import { buildModel, DEFAULT_SETTINGS } from '../../engine'
import { REQUIRED_COLUMNS } from '../../engine/parse'

// DFW→AUS is intra-US (TX→TX), DFW→LHR is US→UK intercontinental
const csv = [
  REQUIRED_COLUMNS.join(','),
  '2018-01-01,AAL,1,DFW,AUS,,,,,false,,2018-01-01T09:00,,,,,,,,Boeing 737,,,,,,,,,,,',
  '2018-02-01,AAL,2,DFW,LHR,,,,,false,,2018-02-01T09:00,,,,,,,,Boeing 747,,,,,,,,,,,',
].join('\n')

describe('countriesCard', () => {
  it('shows United States with flag and "(N states)" annotation', () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    render(<>{countriesCard.render({ model, settings: DEFAULT_SETTINGS })}</>)
    // Should show United States (touched by both flights)
    expect(screen.getByText(/United States/)).toBeInTheDocument()
    // US has regions — should show a "(N state)" sub-label (not the card title)
    expect(screen.getByText(/\(\d+ state/i)).toBeInTheDocument()
  })

  it('expands the US row to reveal the state breakdown (Texas)', async () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    render(<>{countriesCard.render({ model, settings: DEFAULT_SETTINGS })}</>)
    expect(screen.queryByText('Texas')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /\(\d+ state/i }))
    expect(screen.getByText('Texas')).toBeInTheDocument()
  })

  it('shows United Kingdom', () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    render(<>{countriesCard.render({ model, settings: DEFAULT_SETTINGS })}</>)
    expect(screen.getByText(/United Kingdom/)).toBeInTheDocument()
  })
})
