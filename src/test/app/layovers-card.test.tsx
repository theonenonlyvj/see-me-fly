// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { layoversCard } from '../../app/cards/LayoversCard'
import { OverlayProvider, useOverlay } from '../../app/components/Overlay'
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

  it('grouped layover click-through includes ALL metro members (DFW + DAL), not just the connecting code', async () => {
    // Layover via DFW, plus a separate flight via DAL (same Dallas metro).
    const scoped = [
      FL({ id: 'a', rawIndex: 0, fromCode: 'AUS', toCode: 'DFW', depUtcMs: BASE + 10 * HR, arrUtcMs: BASE + 11 * HR }),
      FL({ id: 'b', rawIndex: 1, fromCode: 'DFW', toCode: 'LAX', depUtcMs: BASE + 13 * HR, arrUtcMs: BASE + 15 * HR }),
      FL({ id: 'c', rawIndex: 2, date: '2020-02-01', fromCode: 'DAL', toCode: 'HOU', depUtcMs: BASE + 48 * HR, arrUtcMs: BASE + 49 * HR }),
    ]
    function Harness() {
      const overlay = useOverlay()
      const model = { scoped } as unknown as Model
      return <>{layoversCard.render({ model, settings: DEFAULT_SETTINGS, overlay })}</>
    }
    render(<OverlayProvider><Harness /></OverlayProvider>)
    await userEvent.click(screen.getByText(/Dallas \(DFW\/DAL\)/))
    // the DAL leg must appear in the list — proves filtering by metro key, not the single 'DFW' code
    expect(await screen.findByRole('button', { name: /DAL → HOU/ })).toBeInTheDocument()
  })
})
