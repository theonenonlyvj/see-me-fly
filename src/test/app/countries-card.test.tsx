// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { countriesCard } from '../../app/cards/CountriesCard'
import { OverlayProvider, useOverlay } from '../../app/components/Overlay'

afterEach(cleanup)
import { buildModel, DEFAULT_SETTINGS } from '../../engine'
import { REQUIRED_COLUMNS } from '../../engine/parse'

// DFW→AUS is intra-US (TX→TX), DFW→LHR is US→UK intercontinental
const csv = [
  REQUIRED_COLUMNS.join(','),
  '2018-01-01,AAL,1,DFW,AUS,,,,,false,,2018-01-01T09:00,,,,,,,,Boeing 737,,,,,,,,,,,',
  '2018-02-01,AAL,2,DFW,LHR,,,,,false,,2018-02-01T09:00,,,,,,,,Boeing 747,,,,,,,,,,,',
].join('\n')

const UNSPLIT = { ...DEFAULT_SETTINGS, splitCountriesByState: [] }

describe('countriesCard', () => {
  it('shows United States with flag and "(N states)" annotation when NOT split', () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    render(<>{countriesCard.render({ model, settings: UNSPLIT })}</>)
    expect(screen.getByText(/United States/)).toBeInTheDocument()
    expect(screen.getByText(/\(\d+ state/i)).toBeInTheDocument()
  })

  it('expands the US row to reveal the state breakdown (Texas) when NOT split', async () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    render(<>{countriesCard.render({ model, settings: UNSPLIT })}</>)
    expect(screen.queryByText('Texas')).not.toBeInTheDocument()
    // the state-breakdown disclosure is the only button carrying aria-expanded
    await userEvent.click(screen.getByRole('button', { expanded: false }))
    expect(screen.getByText('Texas')).toBeInTheDocument()
  })

  it('splits US/India/Mexico by default (Texas (USA) shown inline)', () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    render(<>{countriesCard.render({ model, settings: DEFAULT_SETTINGS })}</>)
    expect(screen.getByText(/Texas \(.*USA\)/)).toBeInTheDocument()
  })

  it('shows United Kingdom', () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    render(<>{countriesCard.render({ model, settings: DEFAULT_SETTINGS })}</>)
    expect(screen.getByText(/United Kingdom/)).toBeInTheDocument()
  })

  it('split-by-state promotes states to inline ranked rows ("Texas (USA)"), replacing the country row', () => {
    const settings = { ...DEFAULT_SETTINGS, splitCountriesByState: ['US'] }
    const model = buildModel(csv, settings, '2026-06-25')
    render(<>{countriesCard.render({ model, settings })}</>)
    expect(screen.getByText(/Texas \(.*USA\)/)).toBeInTheDocument()
    expect(screen.queryByText(/United States/)).not.toBeInTheDocument() // country row replaced by its states
  })

  it('clicking a split state row opens that region\'s flight list', async () => {
    const settings = { ...DEFAULT_SETTINGS, splitCountriesByState: ['US'] }
    const model = buildModel(csv, settings, '2026-06-25')
    function Harness() {
      const overlay = useOverlay()
      return <>{countriesCard.render({ model, settings, overlay })}</>
    }
    render(<OverlayProvider><Harness /></OverlayProvider>)
    await userEvent.click(screen.getByText(/Texas \(.*USA\)/))
    expect(await screen.findByText(/Flights in/)).toBeInTheDocument()
  })
})
