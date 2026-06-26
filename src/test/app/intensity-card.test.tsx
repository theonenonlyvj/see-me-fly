// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { intensityCard } from '../../app/cards/IntensityCard'
import { buildModel, DEFAULT_SETTINGS } from '../../engine'
import { REQUIRED_COLUMNS } from '../../engine/parse'

function makeRow(date: string, from: string, to: string): string {
  const fields = new Array<string>(REQUIRED_COLUMNS.length).fill('')
  fields[0]  = date
  fields[1]  = 'AAL'
  fields[2]  = '1'
  fields[3]  = from
  fields[4]  = to
  fields[9]  = 'false'
  return fields.join(',')
}

// Flights spanning two different years so we get two year rows in the heatmap
const csv = [
  REQUIRED_COLUMNS.join(','),
  makeRow('2022-03-10', 'DFW', 'LAX'),
  makeRow('2022-11-20', 'LAX', 'DFW'),
  makeRow('2023-01-05', 'DFW', 'ORD'),
  makeRow('2023-07-15', 'ORD', 'DFW'),
].join('\n')

describe('intensityCard', () => {
  it('renders a year label from the data', () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    render(<>{intensityCard.render({ model, settings: DEFAULT_SETTINGS })}</>)
    expect(screen.getByText('2022')).toBeInTheDocument()
  })

  it('renders the second year label as well', () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    render(<>{intensityCard.render({ model, settings: DEFAULT_SETTINGS })}</>)
    expect(screen.getByText('2023')).toBeInTheDocument()
  })

  it('renders a caption about flights per month', () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    render(<>{intensityCard.render({ model, settings: DEFAULT_SETTINGS })}</>)
    expect(screen.getByText(/flights per month/i)).toBeInTheDocument()
  })
})
