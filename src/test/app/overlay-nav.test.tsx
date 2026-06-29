// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OverlayProvider, useOverlay } from '../../app/components/Overlay'
import { longestCard } from '../../app/cards/LongestCard'
import { buildModel, DEFAULT_SETTINGS } from '../../engine'
import { REQUIRED_COLUMNS } from '../../engine/parse'

afterEach(cleanup)

// 6 flights of varying distance so the "See all" popup appears (>5)
const csv = [REQUIRED_COLUMNS.join(','),
  '2018-01-01,AAL,1,DFW,AUS,,,,,false,,2018-01-01T09:00,,,,,,,,Boeing 737,,,,,,,,,,,',
  '2018-02-01,AAL,2,DFW,LAX,,,,,false,,2018-02-01T09:00,,,,,,,,Boeing 737,,,,,,,,,,,',
  '2018-03-01,AAL,3,DFW,JFK,,,,,false,,2018-03-01T09:00,,,,,,,,Boeing 737,,,,,,,,,,,',
  '2018-04-01,AAL,4,DFW,SFO,,,,,false,,2018-04-01T09:00,,,,,,,,Boeing 737,,,,,,,,,,,',
  '2018-05-01,AAL,5,DFW,MIA,,,,,false,,2018-05-01T09:00,,,,,,,,Boeing 737,,,,,,,,,,,',
  '2018-06-01,AAL,6,DFW,SEA,,,,,false,,2018-06-01T09:00,,,,,,,,Boeing 737,,,,,,,,,,,',
  '2018-07-01,AAL,7,DFW,LHR,,,,,false,,2018-07-01T09:00,,,,,,,,Boeing 777,,,,,,,,,,,',
].join('\n')

function Harness() {
  const overlay = useOverlay()
  const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
  return <>{longestCard.render({ model, settings: DEFAULT_SETTINGS, overlay })}</>
}

describe('overlay back navigation', () => {
  it('list → flight → Back returns to the list (does not close everything)', async () => {
    const user = userEvent.setup()
    render(<OverlayProvider><Harness /></OverlayProvider>)

    // open the "See all" list popup
    await user.click(screen.getByRole('button', { name: /See all/i }))
    expect(await screen.findByText(/Longest by distance/i)).toBeInTheDocument()

    // click a flight row inside the popup → flight detail opens
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByText(/DFW→LHR/))
    // flight detail shows From/To headers
    expect(await screen.findByText('From')).toBeInTheDocument()

    // click Back → should return to the list, NOT close the overlay
    await user.click(screen.getByRole('button', { name: /Back/i }))
    expect(screen.getByText(/Longest by distance/i)).toBeInTheDocument() // list still here
    expect(screen.getByRole('dialog')).toBeInTheDocument() // overlay not closed
  })

  it('inline card row → flight → Back returns to the list (not the dashboard)', async () => {
    const user = userEvent.setup()
    render(<OverlayProvider><Harness /></OverlayProvider>)

    // click a flight directly in the card's inline top-5 (DFW→LHR is the longest)
    await user.click(screen.getByText(/DFW→LHR/))
    expect(await screen.findByText('From')).toBeInTheDocument() // flight detail opened

    // Back must land on the list, not close the whole overlay
    await user.click(screen.getByRole('button', { name: /Back/i }))
    expect(screen.getByText(/Longest by distance/i)).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
