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
  it('shows a resolved airline name', () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    render(<>{airlinesCard.render({ model, settings: DEFAULT_SETTINGS })}</>)
    expect(screen.getByText(/American/i)).toBeInTheDocument()
  })
})
