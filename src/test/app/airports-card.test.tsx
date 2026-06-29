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
    // metro label always includes the member codes: "Dallas (DFW/DAL)"
    expect(screen.getByText(/Dallas \(DFW\/DAL\)/)).toBeInTheDocument()
    // a single airport always shows its code: "Austin (AUS)"
    expect(screen.getByText(/Austin \(AUS\)/)).toBeInTheDocument()
  })

  it('shows the date-aware exclusion pill copy when exclusion is on', () => {
    const s = { ...DEFAULT_SETTINGS, home: 'DFW', excludeHomeFromRankings: true }
    const model = buildModel(csv, s, '2026-06-25')
    render(<>{airportsCard.render({ model, settings: s })}</>)
    expect(screen.getByText(/Home airports excluded for the years each was home/i)).toBeInTheDocument()
  })

  it('lists the home eras on hover (title attr) for a multi-era timeline', () => {
    const s = {
      ...DEFAULT_SETTINGS,
      home: null,
      excludeHomeFromRankings: true,
      homeHistory: [
        { start: '2008-08-18', airports: ['RDU'], label: 'College' },
        { start: '2013-01-15', airports: ['DFW', 'DAL'] },
      ],
    }
    const model = buildModel(csv, s, '2026-06-25')
    const { container } = render(<>{airportsCard.render({ model, settings: s })}</>)
    const note = container.querySelector('[data-home-eras]')
    expect(note).not.toBeNull()
    const title = note!.getAttribute('title') ?? ''
    expect(title).toMatch(/RDU/)
    expect(title).toMatch(/DFW/)
    expect(title).toMatch(/2008-08-18/)
  })

  it('no exclusion pill copy when exclusion is off', () => {
    const s = { ...DEFAULT_SETTINGS, home: 'DFW', excludeHomeFromRankings: false }
    const model = buildModel(csv, s, '2026-06-25')
    render(<>{airportsCard.render({ model, settings: s })}</>)
    expect(screen.queryByText(/Home airports excluded for the years each was home/i)).toBeNull()
  })
})
