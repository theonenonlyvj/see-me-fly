// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OverlayProvider, useOverlay } from '../../app/components/Overlay'
import { countriesCard } from '../../app/cards/CountriesCard'
import { buildModel, DEFAULT_SETTINGS } from '../../engine'
import { REQUIRED_COLUMNS } from '../../engine/parse'
import type { EnrichedFlight, Settings } from '../../engine'
import type { Model } from '../../app/state/useModel'

afterEach(cleanup)

const FL = (o: Partial<EnrichedFlight>): EnrichedFlight => ({
  id: 'x', resolved: true, isLocalFlight: false, rawIndex: 0, date: '2020-01-01',
  fromCode: 'AUS', toCode: 'DFW', airlineName: 'American Airlines',
  distanceMi: 190, durationMin: 60, from: null, to: null, depUtcMs: null, arrUtcMs: null,
  ...o,
} as EnrichedFlight)

function ListHarness({ flights }: { flights: EnrichedFlight[] }) {
  const { openFlights } = useOverlay()
  return <button onClick={() => openFlights('Test list', flights)}>open</button>
}

describe('Overlay', () => {
  it('opens a flight list, drills into a flight, and Escape navigates back then closes', async () => {
    const flights = [FL({ id: 'a', date: '2020-03-01' }), FL({ id: 'b', date: '2019-01-01', toCode: 'LAX' })]
    render(<OverlayProvider><ListHarness flights={flights} /></OverlayProvider>)

    await userEvent.click(screen.getByRole('button', { name: 'open' }))
    expect(screen.getByText('Test list')).toBeInTheDocument()

    // drill into the most-recent flight (sorted desc → 2020-03-01 first)
    await userEvent.click(screen.getByRole('button', { name: /2020-03-01/ }))
    expect(screen.getByText('From')).toBeInTheDocument()
    expect(screen.getByText('To')).toBeInTheDocument()

    // Escape pops back to the list
    await userEvent.keyboard('{Escape}')
    expect(screen.getByText('Test list')).toBeInTheDocument()
    // Escape again dismisses
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByText('Test list')).not.toBeInTheDocument()
  })
})

const csv = [
  REQUIRED_COLUMNS.join(','),
  '2018-01-01,AAL,1,DFW,AUS,,,,,false,,2018-01-01T09:00,,,,,,,,Boeing 737,,,,,,,,,,,',
  '2018-02-01,AAL,2,DFW,LHR,,,,,false,,2018-02-01T09:00,,,,,,,,Boeing 747,,,,,,,,,,,',
].join('\n')

function CardHarness({ model, settings }: { model: Model; settings: Settings }) {
  const overlay = useOverlay()
  return <>{countriesCard.render({ model, settings, overlay })}</>
}

describe('card click-through', () => {
  it('clicking a country row opens its flight list', async () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    render(<OverlayProvider><CardHarness model={model} settings={DEFAULT_SETTINGS} /></OverlayProvider>)
    await userEvent.click(screen.getByText(/United States/))
    expect(await screen.findByText(/Flights touching/)).toBeInTheDocument()
  })
})
