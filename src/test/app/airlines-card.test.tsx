// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { airlinesCard } from '../../app/cards/AirlinesCard'
import { buildModel, DEFAULT_SETTINGS } from '../../engine'
import { REQUIRED_COLUMNS } from '../../engine/parse'

const csv = [REQUIRED_COLUMNS.join(','),
  '2018-01-01,AAL,1,DFW,AUS,,,,,false,,2018-01-01T09:00,,,,,,,,Boeing 737,,,,,,,,,,,',
].join('\n')

describe('airlinesCard', () => {
  it('shows the airline brand logo (alt = resolved name)', () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    render(<>{airlinesCard.render({ model, settings: DEFAULT_SETTINGS })}</>)
    // American Airlines has a bundled logo → rendered as a wordmark <img> with its name as alt text
    expect(screen.getByRole('img', { name: /American/i })).toBeInTheDocument()
  })
})
