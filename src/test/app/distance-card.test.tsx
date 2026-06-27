// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { distanceCard } from '../../app/cards/DistanceCard'
import { buildModel, DEFAULT_SETTINGS, type Settings } from '../../engine'
import { REQUIRED_COLUMNS } from '../../engine/parse'

const csv = [REQUIRED_COLUMNS.join(','),
  '2018-01-01,AAL,1,DFW,AUS,,,,,false,,2018-01-01T09:00,,,,,,,,Boeing 737,,,,,,,,,,,', // ~190mi <300
  '2018-02-01,AAL,2,DFW,LHR,,,,,false,,2018-02-01T09:00,,,,,,,,Boeing 777,,,,,,,,,,,', // ~4700mi
].join('\n')

describe('distanceCard', () => {
  it('renders the <300 band with a count', () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    render(<>{distanceCard.render({ model, settings: DEFAULT_SETTINGS })}</>)
    expect(screen.getByText(/<300 mi/)).toBeInTheDocument()
  })

  it('renders custom bands from settings.distanceEdges', () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    const settings: Settings = { ...DEFAULT_SETTINGS, distanceEdges: [500, 5000] }
    render(<>{distanceCard.render({ model, settings })}</>)
    expect(screen.getByText(/<500 mi/)).toBeInTheDocument()
    expect(screen.getByText(/5,000\+ mi/)).toBeInTheDocument()
  })

  it('editing a band edge commits sorted, normalized edges via update', async () => {
    const user = userEvent.setup()
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    let patch: Partial<Settings> | null = null
    const update = (p: Partial<Settings>) => { patch = p }
    render(<>{distanceCard.render({ model, settings: { ...DEFAULT_SETTINGS, distanceEdges: [300, 700] }, update })}</>)
    const second = screen.getByLabelText('Distance band edge 2')
    await user.clear(second)
    await user.type(second, '250') // draft becomes [300, 250]
    await user.tab() // blur → commit
    expect(patch).toEqual({ distanceEdges: [250, 300] })
  })

  it('reverts a fractional edit that would round onto another edge (no band collapse)', async () => {
    const user = userEvent.setup()
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    let calls = 0
    const update = () => { calls++ }
    render(<>{distanceCard.render({ model, settings: { ...DEFAULT_SETTINGS, distanceEdges: [300, 700] }, update })}</>)
    const second = screen.getByLabelText('Distance band edge 2')
    await user.clear(second)
    await user.type(second, '300.4') // rounds to 300 → collides with edge 1
    await user.tab()
    expect(calls).toBe(0)
    expect((screen.getByLabelText('Distance band edge 2') as HTMLInputElement).value).toBe('700') // reverted
  })

  it('reverts invalid edits (blank/non-positive) without calling update', async () => {
    const user = userEvent.setup()
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    let calls = 0
    const update = () => { calls++ }
    render(<>{distanceCard.render({ model, settings: { ...DEFAULT_SETTINGS, distanceEdges: [300, 700] }, update })}</>)
    const first = screen.getByLabelText('Distance band edge 1')
    await user.clear(first) // blank → invalid
    await user.tab()
    expect(calls).toBe(0)
    expect((screen.getByLabelText('Distance band edge 1') as HTMLInputElement).value).toBe('300') // reverted
  })
})
