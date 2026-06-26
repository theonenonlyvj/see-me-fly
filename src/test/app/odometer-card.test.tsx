// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { odometerCard } from '../../app/cards/OdometerCard'
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

// DFW→LHR ~4750 mi; DFW→SYD ~8500 mi; total ~13250 mi
const csv = [
  REQUIRED_COLUMNS.join(','),
  makeRow('2018-01-01', 'DFW', 'LHR'),
  makeRow('2018-02-01', 'DFW', 'SYD'),
  makeRow('2018-03-01', 'DFW', 'AUS'),
].join('\n')

describe('odometerCard', () => {
  it('renders "around the Earth" hero text', () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    render(<>{odometerCard.render({ model, settings: DEFAULT_SETTINGS })}</>)
    expect(screen.getByText(/around the earth/i)).toBeInTheDocument()
  })

  it('renders "to the Moon" caption', () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    render(<>{odometerCard.render({ model, settings: DEFAULT_SETTINGS })}</>)
    expect(screen.getByText(/moon/i)).toBeInTheDocument()
  })

  it('renders total miles in miles format', () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    render(<>{odometerCard.render({ model, settings: DEFAULT_SETTINGS })}</>)
    expect(screen.getByText(/ mi$/)).toBeInTheDocument()
  })
})
