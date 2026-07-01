// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { homeAwayCard } from '../../app/cards/HomeAwayCard'
import HomeAwayRibbon from '../../app/components/charts/HomeAwayRibbon'
import { buildModel, DEFAULT_SETTINGS } from '../../engine'
import { REQUIRED_COLUMNS } from '../../engine/parse'
import type { Settings } from '../../engine'
import type { RibbonYear } from '../../engine/stats'

// A domestic round trip (DFW↔AUS) + a transatlantic round trip (DFW↔LHR), across two years.
const csv = [
  REQUIRED_COLUMNS.join(','),
  '2018-03-05,AAL,1,DFW,AUS,,,,,false,,2018-03-05T09:00,,,,,,,,Boeing 737,,,,,,,,,,,',
  '2018-03-08,AAL,2,AUS,DFW,,,,,false,,2018-03-08T09:00,,,,,,,,Boeing 737,,,,,,,,,,,',
  '2019-07-01,AAL,3,DFW,LHR,,,,,false,,2019-07-01T09:00,,,,,,,,Boeing 777,,,,,,,,,,,',
  '2019-07-12,AAL,4,LHR,DFW,,,,,false,,2019-07-12T09:00,,,,,,,,Boeing 777,,,,,,,,,,,',
].join('\n')

const SETTINGS: Settings = { ...DEFAULT_SETTINGS, home: 'DFW', homeHistory: [{ start: '2010-01-01', airports: ['DFW'] }] }

describe('homeAwayCard', () => {
  it('renders the ribbon without throwing and shows the tier legend', () => {
    const model = buildModel(csv, SETTINGS, '2026-06-25')
    render(<>{homeAwayCard.render({ model, settings: SETTINGS })}</>)
    expect(screen.getByRole('heading', { name: 'Home & away' })).toBeInTheDocument()
    // legend swatches
    expect(screen.getByText('Domestic')).toBeInTheDocument()
    expect(screen.getByText('Transatlantic')).toBeInTheDocument()
    expect(screen.getByText('Transpacific')).toBeInTheDocument()
    // honesty caption
    expect(screen.getByText(/hatched = an estimated trip boundary/i)).toBeInTheDocument()
  })

  it('shows the no-home empty state when no home is configured', () => {
    const noHome: Settings = { ...DEFAULT_SETTINGS, home: null, homeHistory: [] }
    const model = buildModel(csv, noHome, '2026-06-25')
    render(<>{homeAwayCard.render({ model, settings: noHome })}</>)
    expect(screen.getByRole('heading', { name: 'Home & away' })).toBeInTheDocument()
    expect(screen.getByText(/Set your home airport/i)).toBeInTheDocument()
    // no legend in the empty state
    expect(screen.queryByText('Transatlantic')).not.toBeInTheDocument()
  })

  it('has stable identity in the registry', () => {
    expect(homeAwayCard.id).toBe('homeAway')
    expect(homeAwayCard.group).toBe('creative')
  })
})

describe('HomeAwayRibbon chart', () => {
  it('draws an SVG with one away rect per span + hatch on estimated spans', () => {
    const rows: RibbonYear[] = [
      { year: 2019, totalDays: 365, awayDays: 5, spans: [
        { startDoy: 60, endDoy: 64, tier: 'domestic', estimated: false },
        { startDoy: 182, endDoy: 191, tier: 'transatlantic', estimated: true },
      ] },
    ]
    const { container } = render(
      <HomeAwayRibbon
        rows={rows}
        longestHome={{ days: 120, startDate: '2019-03-06', endDate: '2019-07-03' }}
        longestAway={{ days: 10, startDate: '2019-07-01', endDate: '2019-07-10' }}
      />,
    )
    expect(container.querySelector('svg')).toBeTruthy()
    // the hatch pattern def exists and is referenced by the estimated span
    expect(container.querySelector('pattern#ha-hatch')).toBeTruthy()
    expect(container.querySelector('rect[fill="url(#ha-hatch)"]')).toBeTruthy()
    // bracket annotation labels render
    expect(screen.getByText(/days away ·/i)).toBeInTheDocument()
    expect(screen.getByText(/days home ·/i)).toBeInTheDocument()
    // the per-row "% away" text
    expect(screen.getByText(/% away/i)).toBeInTheDocument()
  })

  it('renders an empty svg with no rows without throwing', () => {
    const { container } = render(<HomeAwayRibbon rows={[]} longestHome={null} longestAway={null} />)
    expect(container.querySelector('svg')).toBeTruthy()
  })
})
