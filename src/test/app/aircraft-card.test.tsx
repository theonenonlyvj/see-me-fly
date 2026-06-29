// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { aircraftCard, aircraftClassCard } from '../../app/cards/AircraftCard'
import { OverlayProvider, useOverlay } from '../../app/components/Overlay'
import { buildModel, DEFAULT_SETTINGS } from '../../engine'
import { REQUIRED_COLUMNS } from '../../engine/parse'
import type { Settings } from '../../engine'

afterEach(cleanup)

// Boeing 737 (narrow) ×2, Boeing 747 (wide), Airbus A320
const csv = [
  REQUIRED_COLUMNS.join(','),
  '2018-01-01,AAL,1,DFW,AUS,,,,,false,,2018-01-01T09:00,,,,,,,,Boeing 737-800,,,,,,,,,,,',
  '2018-02-01,UAL,2,DFW,SFO,,,,,false,,2018-02-01T09:00,,,,,,,,Boeing 737-700,,,,,,,,,,,',
  '2018-03-01,AAL,3,DFW,LHR,,,,,false,,2018-03-01T09:00,,,,,,,,Boeing 747-400,,,,,,,,,,,',
  '2018-04-01,AAL,4,DFW,JFK,,,,,false,,2018-04-01T09:00,,,,,,,,Airbus A320,,,,,,,,,,,',
].join('\n')

describe('aircraftClassCard', () => {
  it('shows body-class labels', () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    render(<>{aircraftClassCard.render({ model, settings: DEFAULT_SETTINGS })}</>)
    expect(screen.getByText('Aircraft class')).toBeInTheDocument()
    expect(screen.getAllByText(/Narrowbody|Widebody/).length).toBeGreaterThan(0)
  })
})

describe('aircraftCard (by brand)', () => {
  it('groups by manufacturer with a model sub-count', () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    render(<>{aircraftCard.render({ model, settings: DEFAULT_SETTINGS })}</>)
    expect(screen.getByText('Boeing')).toBeInTheDocument()
    expect(screen.getByText('Airbus')).toBeInTheDocument()
  })

  it('clicking a brand opens that brand’s flights (with the subset map)', async () => {
    const settings: Settings = DEFAULT_SETTINGS
    const model = buildModel(csv, settings, '2026-06-25')
    function Harness() {
      const overlay = useOverlay()
      return <>{aircraftCard.render({ model, settings, overlay })}</>
    }
    render(<OverlayProvider><Harness /></OverlayProvider>)
    await userEvent.click(screen.getByText('Boeing'))
    // overlay opens the Boeing flight subset (FlightsBody renders a fit map + the flight list)
    expect(await screen.findByText(/Boeing flights/)).toBeInTheDocument()
  })
})
