// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { geoExtremesCard } from '../../app/cards/GeoExtremesCard'
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

// SYD (Sydney, Australia) is very far from DFW (home), and far south
// LHR (London Heathrow) is far north
// DFW is in Texas
const csv = [
  REQUIRED_COLUMNS.join(','),
  makeRow('2018-01-01', 'DFW', 'LHR'),
  makeRow('2018-02-01', 'DFW', 'SYD'),
  makeRow('2018-03-01', 'DFW', 'AUS'),
].join('\n')

describe('geoExtremesCard', () => {
  it('shows farthest airport name', () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    render(<>{geoExtremesCard.render({ model, settings: DEFAULT_SETTINGS })}</>)
    // SYD (Sydney) should be farthest from DFW (home lat/lon)
    expect(screen.getByText(/farthest from home/i)).toBeInTheDocument()
  })

  it('shows northernmost label', () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    render(<>{geoExtremesCard.render({ model, settings: DEFAULT_SETTINGS })}</>)
    expect(screen.getByText(/northernmost/i)).toBeInTheDocument()
  })

  it('shows southernmost label', () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    render(<>{geoExtremesCard.render({ model, settings: DEFAULT_SETTINGS })}</>)
    expect(screen.getByText(/southernmost/i)).toBeInTheDocument()
  })

  it('renders empty-state when no resolved airports', () => {
    const emptyCSV = [REQUIRED_COLUMNS.join(',')].join('\n')
    const model = buildModel(emptyCSV, DEFAULT_SETTINGS, '2026-06-25')
    render(<>{geoExtremesCard.render({ model, settings: DEFAULT_SETTINGS })}</>)
    expect(screen.getByText(/no data/i)).toBeInTheDocument()
  })
})
