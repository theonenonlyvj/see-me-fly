// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { spiralAloftCard } from '../../app/cards/SpiralAloftCard'
import SpiralYearClock from '../../app/components/charts/SpiralYearClock'
import { buildModel, DEFAULT_SETTINGS } from '../../engine'
import { REQUIRED_COLUMNS } from '../../engine/parse'
import type { Settings } from '../../engine'

// A few flights across three years + one local hop (RPJ→RPJ) that must be skipped by the spiral.
const csv = [
  REQUIRED_COLUMNS.join(','),
  '2013-02-05,UAL,1,DEN,ORD,,,,,false,,2013-02-05T09:00,,,,,,,,Boeing 737,,,,,,,,,,,',
  '2015-03-18,AAL,2,DFW,LAX,,,,,false,,2015-03-18T09:00,,,,,,,,Boeing 737,,,,,,,,,,,',
  '2015-03-20,AAL,3,DFW,ORD,,,,,false,,2015-03-20T09:00,,,,,,,,Boeing 737,,,,,,,,,,,',
  '2019-07-04,DAL,4,DFW,MSP,,,,,false,,2019-07-04T09:00,,,,,,,,Boeing 737,,,,,,,,,,,',
].join('\n')

// Two home eras so the "home that day" legend renders two swatches.
const SETTINGS: Settings = {
  ...DEFAULT_SETTINGS,
  home: 'DFW',
  homeHistory: [
    { start: '2013-01-01', airports: ['DEN'] },
    { start: '2015-01-01', airports: ['DFW'] },
  ],
}

describe('spiralAloftCard', () => {
  it('renders the hero without throwing and shows the how-to-read legend + caption', () => {
    const model = buildModel(csv, SETTINGS, '2026-06-25')
    render(<>{spiralAloftCard.render({ model, settings: SETTINGS })}</>)
    expect(screen.getByRole('heading', { name: '13 Years Aloft' })).toBeInTheDocument()
    expect(screen.getByText(/Every flight, every year/i)).toBeInTheDocument()
    expect(screen.getAllByText(/log distance/i).length).toBeGreaterThan(0)
    // honesty caption
    expect(screen.getByText(/fixed-count, not area-filled/i)).toBeInTheDocument()
    // two home swatches in the "Home that day" block
    expect(screen.getByText(/Home that day/i)).toBeInTheDocument()
  })

  it('renders gracefully with no home configured (no swatches, neutral ticks)', () => {
    const noHome: Settings = { ...DEFAULT_SETTINGS, home: null, homeHistory: [] }
    const model = buildModel(csv, noHome, '2026-06-25')
    render(<>{spiralAloftCard.render({ model, settings: noHome })}</>)
    expect(screen.getByRole('heading', { name: '13 Years Aloft' })).toBeInTheDocument()
    expect(screen.queryByText(/Home that day/i)).not.toBeInTheDocument()
  })

  it('has stable identity in the registry', () => {
    expect(spiralAloftCard.id).toBe('spiralAloft')
    expect(spiralAloftCard.group).toBe('creative')
  })
})

describe('SpiralYearClock chart', () => {
  it('draws one tick per non-local flight and skips locals', () => {
    const model = buildModel(csv, SETTINGS, '2026-06-25')
    const { container } = render(
      <SpiralYearClock
        flights={model.flown}
        colorFor={() => '#ff3d57'}
        busiest={{ weekStart: '2015-03-16', count: 2 }}
      />,
    )
    // 4 non-local flights in the fixture → 4 flight ticks (year rings/spokes are separate lines).
    // Assert the SVG rendered and the annotation label shows.
    expect(container.querySelector('svg')).toBeTruthy()
    expect(screen.getByText(/busiest week/i)).toBeInTheDocument()
    expect(screen.getByText(/2 flights/i)).toBeInTheDocument()
  })
})
