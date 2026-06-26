// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { routesCard } from '../../app/cards/RoutesCard'
import { buildModel, DEFAULT_SETTINGS } from '../../engine'
import { REQUIRED_COLUMNS } from '../../engine/parse'

const csv = [REQUIRED_COLUMNS.join(','),
  '2018-01-01,AAL,1,DFW,AUS,,,,,false,,2018-01-01T09:00,,,,,,,,Boeing 737,,,,,,,,,,,',
  '2018-02-01,AAL,2,DFW,LHR,,,,,false,,2018-02-01T09:00,,,,,,,,Boeing 777,,,,,,,,,,,',
].join('\n')

describe('routesCard', () => {
  it('renders routes and supports the metric toggle', async () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    render(<>{routesCard.render({ model, settings: DEFAULT_SETTINGS })}</>)
    // a route label uses the ↔ undirected separator under default settings
    expect(screen.getAllByText(/↔/)).toHaveLength(2)
    const milesButton = screen.getByRole('button', { name: /miles/i })
    await userEvent.click(milesButton)
    expect(screen.getByRole('button', { name: /miles/i })).toHaveStyle('background: var(--accent)')
  })
})
