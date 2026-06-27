// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { superDomesticCard } from '../../app/cards/SuperDomesticCard'
import { buildModel, DEFAULT_SETTINGS } from '../../engine'
import { REQUIRED_COLUMNS } from '../../engine/parse'

// DFW→AUS: intra-state (TX-TX)
// DFW→LHR: intercontinental (excluded from super-domestic)
// DFW→MEX: intra-continent (NA-NA, US→MX different countries same continent)
const csv = [
  REQUIRED_COLUMNS.join(','),
  '2018-01-01,AAL,1,DFW,AUS,,,,,false,,2018-01-01T09:00,,,,,,,,Boeing 737,,,,,,,,,,,',
  '2018-02-01,AAL,2,DFW,LHR,,,,,false,,2018-02-01T09:00,,,,,,,,Boeing 747,,,,,,,,,,,',
  '2018-03-01,AAL,3,DFW,MEX,,,,,false,,2018-03-01T09:00,,,,,,,,Boeing 737,,,,,,,,,,,',
].join('\n')

describe('superDomesticCard', () => {
  it('labels the intra-state tier with the home state ("Within Texas" for home=DFW)', () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    render(<>{superDomesticCard.render({ model, settings: DEFAULT_SETTINGS })}</>)
    expect(screen.getByText(/Within Texas/i)).toBeInTheDocument()
  })

  it('shows a TX domestic route (DFW / AUS)', () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    render(<>{superDomesticCard.render({ model, settings: DEFAULT_SETTINGS })}</>)
    // Route key will contain DFW or Dallas (may be multiple matches across tiers)
    expect(screen.getAllByText(/DFW|Dallas/i).length).toBeGreaterThan(0)
  })
})
