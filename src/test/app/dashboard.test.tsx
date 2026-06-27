// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Dashboard from '../../app/components/CardGrid'
import { buildModel, DEFAULT_SETTINGS } from '../../engine'
import { REQUIRED_COLUMNS } from '../../engine/parse'

const csv = [REQUIRED_COLUMNS.join(','),
  '2018-01-01,AAL,1,DFW,AUS,,,,,false,,2018-01-01T09:00,,,,,,,,Boeing 737,,,,,,,,,,,',
].join('\n')

describe('CardGrid', () => {
  it('renders all registered cards', () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    render(<Dashboard model={model} settings={DEFAULT_SETTINGS} />)
    expect(screen.getByRole('heading', { name: 'Overview' })).toBeInTheDocument()
    expect(screen.getByText(/Most-visited airports/i)).toBeInTheDocument()
  })

  it('groups cards under storyline section headers', () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    render(<Dashboard model={model} settings={DEFAULT_SETTINGS} />)
    expect(screen.getByRole('heading', { name: 'The big picture' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: "Where you've been" })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'How far you go' })).toBeInTheDocument()
  })
})
