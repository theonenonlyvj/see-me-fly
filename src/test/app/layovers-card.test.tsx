// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { layoversCard } from '../../app/cards/LayoversCard'
import { DEFAULT_SETTINGS } from '../../engine'
import type { EnrichedFlight } from '../../engine/types'
import type { Model } from '../../app/state/useModel'

afterEach(cleanup)

const HR = 3_600_000
const BASE = Date.parse('2020-01-01T00:00:00Z')
const FL = (o: Partial<EnrichedFlight>): EnrichedFlight => ({
  resolved: true, isLocalFlight: false, rawIndex: 0, date: '2020-01-01',
  fromCode: 'AAA', toCode: 'BBB', arrUtcMs: null, depUtcMs: null,
  ...o,
} as EnrichedFlight)

describe('layoversCard', () => {
  it('renders the top connection airport with its metro member codes', () => {
    const scoped = [
      FL({ rawIndex: 0, fromCode: 'AUS', toCode: 'DFW', depUtcMs: BASE + 10 * HR, arrUtcMs: BASE + 11 * HR }),
      FL({ rawIndex: 1, fromCode: 'DFW', toCode: 'LAX', depUtcMs: BASE + 13 * HR, arrUtcMs: BASE + 15 * HR }),
    ]
    const model = { scoped } as unknown as Model
    render(<>{layoversCard.render({ model, settings: DEFAULT_SETTINGS })}</>)
    expect(screen.getByText(/Dallas \(DFW\/DAL\)/)).toBeInTheDocument()
  })

  it('shows the empty state when there are no connections', () => {
    const model = { scoped: [] as EnrichedFlight[] } as unknown as Model
    render(<>{layoversCard.render({ model, settings: DEFAULT_SETTINGS })}</>)
    expect(screen.getByText(/No data for this view/i)).toBeInTheDocument()
  })
})
