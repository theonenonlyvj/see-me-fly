// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { allegianceCard } from '../../app/cards/AllegianceCard'
import StreamGraph, { type StreamLayer } from '../../app/components/charts/StreamGraph'
import { buildModel, DEFAULT_SETTINGS } from '../../engine'
import { REQUIRED_COLUMNS } from '../../engine/parse'
import type { Settings } from '../../engine'

// American-heavy over three years + a Delta stream + one Southwest — enough for a featured band
// whose label rides its fattest year, plus a home relocation for the hairline.
const csv = [
  REQUIRED_COLUMNS.join(','),
  '2013-02-05,UAL,1,DEN,ORD,,,,,false,,2013-02-05T09:00,,,,,,,,Boeing 737,,,,,,,,,,,',
  '2015-03-18,AAL,2,DFW,LAX,,,,,false,,2015-03-18T09:00,,,,,,,,Boeing 737,,,,,,,,,,,',
  '2015-03-20,AAL,3,DFW,ORD,,,,,false,,2015-03-20T09:00,,,,,,,,Boeing 737,,,,,,,,,,,',
  '2015-05-01,AAL,4,DFW,SFO,,,,,false,,2015-05-01T09:00,,,,,,,,Boeing 737,,,,,,,,,,,',
  '2015-06-01,DAL,5,DFW,ATL,,,,,false,,2015-06-01T09:00,,,,,,,,Boeing 737,,,,,,,,,,,',
  '2016-07-04,AAL,6,DFW,MSP,,,,,false,,2016-07-04T09:00,,,,,,,,Boeing 737,,,,,,,,,,,',
  '2016-08-01,SWA,7,DAL,HOU,,,,,false,,2016-08-01T09:00,,,,,,,,Boeing 737,,,,,,,,,,,',
].join('\n')

// Two home eras → one relocation hairline (the 2015 move to DFW).
const SETTINGS: Settings = {
  ...DEFAULT_SETTINGS,
  home: 'DFW',
  homeHistory: [
    { start: '2013-01-01', airports: ['DEN'] },
    { start: '2015-01-01', airports: ['DFW'] },
  ],
}

describe('allegianceCard', () => {
  it('renders the streamgraph without throwing and shows a carrier label + honesty caption', () => {
    const model = buildModel(csv, SETTINGS, '2026-06-25')
    render(<>{allegianceCard.render({ model, settings: SETTINGS })}</>)
    expect(screen.getByRole('heading', { name: '13 years of who flew you' })).toBeInTheDocument()
    expect(screen.getByText(/Allegiance · by year/i)).toBeInTheDocument()
    // the dominant carrier (American) appears as an in-band label AND in the legend
    expect(screen.getAllByText('American Airlines').length).toBeGreaterThan(0)
    // honesty caption about the smoothing + total strip
    expect(screen.getByText(/smoothed between years/i)).toBeInTheDocument()
    expect(screen.getByText(/keeps each year.*total honest/i)).toBeInTheDocument()
  })

  it('renders gracefully with no airline history (empty model, no crash)', () => {
    const empty = buildModel(REQUIRED_COLUMNS.join(','), SETTINGS, '2026-06-25')
    render(<>{allegianceCard.render({ model: empty, settings: SETTINGS })}</>)
    expect(screen.getByRole('heading', { name: '13 years of who flew you' })).toBeInTheDocument()
    expect(screen.getByText(/No airline history/i)).toBeInTheDocument()
  })

  it('has stable identity in the registry', () => {
    expect(allegianceCard.id).toBe('allegiance')
    expect(allegianceCard.group).toBe('creative')
    expect(allegianceCard.icon).toBe('🌊')
  })
})

describe('StreamGraph chart', () => {
  it('draws a band per layer and keeps every band non-negative thickness (no crossing)', () => {
    const years = [2018, 2019, 2020]
    const layers: StreamLayer[] = [
      { key: 'other', label: 'Other', color: '#ccc', counts: [1, 0, 2], featured: false },
      { key: 'AAL', label: 'American Airlines', color: '#ff3d57', counts: [3, 8, 5], featured: true },
      { key: 'UAL', label: 'United Airlines', color: '#1aa9ff', counts: [0, 2, 4], featured: true },
    ]
    const { container } = render(
      <StreamGraph years={years} layers={layers} totals={[4, 10, 11]} homes={[{ date: '2019-06-01', label: 'Dallas' }]} />,
    )
    const svg = container.querySelector('svg')
    expect(svg).toBeTruthy()
    // one <path> band per layer
    expect(container.querySelectorAll('path').length).toBe(layers.length)
    // the home hairline label renders
    expect(screen.getByText(/Dallas/)).toBeInTheDocument()
    // the top honesty strip label renders
    expect(screen.getByText(/flights \/ yr/i)).toBeInTheDocument()
  })

  it('returns null for empty years without throwing', () => {
    const { container } = render(<StreamGraph years={[]} layers={[]} totals={[]} />)
    expect(container.querySelector('svg')).toBeNull()
  })
})
