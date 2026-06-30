// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { domesticStateCard, domesticCountryCard } from '../../app/cards/SuperDomesticCard'
import { buildModel, DEFAULT_SETTINGS } from '../../engine'
import { REQUIRED_COLUMNS } from '../../engine/parse'

afterEach(cleanup)

// DFW→AUS: intra-state (TX-TX, home state)
// DFW→MEX: intra-continent (NA-NA, US→MX)
// MEX→CUN: intra-country (within Mexico)
const csv = [
  REQUIRED_COLUMNS.join(','),
  '2018-01-01,AAL,1,DFW,AUS,,,,,false,,2018-01-01T09:00,,,,,,,,Boeing 737,,,,,,,,,,,',
  '2018-03-01,AAL,3,DFW,MEX,,,,,false,,2018-03-01T09:00,,,,,,,,Boeing 737,,,,,,,,,,,',
  '2018-04-01,AAL,4,MEX,CUN,,,,,false,,2018-04-01T09:00,,,,,,,,Boeing 737,,,,,,,,,,,',
].join('\n')

describe('domestic tier cards', () => {
  it('home-state card titles with the home state ("Within Texas") and shows its route', () => {
    // Default home is now UNSET; the home-state title needs an explicit home.
    const dfw = { ...DEFAULT_SETTINGS, home: 'DFW' }
    const model = buildModel(csv, dfw, '2026-06-25')
    render(<>{domesticStateCard.render({ model, settings: dfw })}</>)
    expect(screen.getByText(/Within Texas/i)).toBeInTheDocument()
    expect(screen.getAllByText(/DFW|Dallas|AUS|Austin/i).length).toBeGreaterThan(0)
  })

  it('within-a-country card renders its own card', () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    render(<>{domesticCountryCard.render({ model, settings: DEFAULT_SETTINGS })}</>)
    expect(screen.getByText(/Within a country/i)).toBeInTheDocument()
  })

  it('single legacy home keeps the single-state title ("Within Texas")', () => {
    const model = buildModel(csv, { ...DEFAULT_SETTINGS, home: 'DFW' }, '2026-06-25')
    render(<>{domesticStateCard.render({ model, settings: { ...DEFAULT_SETTINGS, home: 'DFW' } })}</>)
    expect(screen.getByText(/Within Texas/i)).toBeInTheDocument()
  })

  it('multiple distinct home-state eras use the multi-era title', () => {
    // RDU (North Carolina) then DFW (Texas) — two distinct home regions.
    const s = {
      ...DEFAULT_SETTINGS,
      home: null,
      homeHistory: [
        { start: '2008-08-18', airports: ['RDU'] },
        { start: '2013-01-15', airports: ['DFW', 'DAL'] },
      ],
    }
    const model = buildModel(csv, s, '2026-06-25')
    render(<>{domesticStateCard.render({ model, settings: s })}</>)
    expect(screen.getByText(/Within your home state\(s\)/i)).toBeInTheDocument()
  })
})
