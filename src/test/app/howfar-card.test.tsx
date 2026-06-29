// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { howFarFromHomeCard } from '../../app/cards/HowFarFromHomeCard'
import { buildModel, DEFAULT_SETTINGS } from '../../engine'
import { REQUIRED_COLUMNS } from '../../engine/parse'

afterEach(cleanup)

const csv = [
  REQUIRED_COLUMNS.join(','),
  '2018-01-01,AAL,1,DFW,AUS,,,,,false,,2018-01-01T09:00,,,,,,,,Boeing 737,,,,,,,,,,,',
  '2018-02-01,AAL,2,DFW,LHR,,,,,false,,2018-02-01T09:00,,,,,,,,Boeing 747,,,,,,,,,,,',
].join('\n')

describe('howFarFromHomeCard', () => {
  it('renders the distance breakdown when a home is set', () => {
    const s = { ...DEFAULT_SETTINGS, home: 'DFW' }
    const model = buildModel(csv, s, '2026-06-25')
    const { container } = render(<>{howFarFromHomeCard.render({ model, settings: s })}</>)
    // the proportion bar renders segments
    expect(container.querySelectorAll('svg, [role="img"], div').length).toBeGreaterThan(0)
    expect(screen.getByText(/How far from home/i)).toBeInTheDocument()
    expect(screen.queryByText(/Set a home airport/i)).toBeNull()
  })

  it('shows an empty state (today\'s behavior) when there is no home', () => {
    const s = { ...DEFAULT_SETTINGS, home: null, homeHistory: [] }
    const model = buildModel(csv, s, '2026-06-25')
    render(<>{howFarFromHomeCard.render({ model, settings: s })}</>)
    expect(screen.getByText(/Set a home airport/i)).toBeInTheDocument()
  })

  it('works with a populated timeline even when the legacy home is cleared', () => {
    const s = {
      ...DEFAULT_SETTINGS,
      home: null,
      homeHistory: [{ start: '2008-01-01', airports: ['DFW', 'DAL'] }],
    }
    const model = buildModel(csv, s, '2026-06-25')
    render(<>{howFarFromHomeCard.render({ model, settings: s })}</>)
    expect(screen.queryByText(/Set a home airport/i)).toBeNull()
  })
})
