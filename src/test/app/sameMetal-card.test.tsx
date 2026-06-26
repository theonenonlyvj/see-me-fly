// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { sameMetalCard } from '../../app/cards/SameMetalCard'
import { buildModel, DEFAULT_SETTINGS } from '../../engine'
import { REQUIRED_COLUMNS } from '../../engine/parse'

function makeRow(date: string, from: string, to: string, tail: string): string {
  const fields = new Array<string>(REQUIRED_COLUMNS.length).fill('')
  fields[0]  = date
  fields[1]  = 'AAL'
  fields[2]  = '1'
  fields[3]  = from
  fields[4]  = to
  fields[9]  = 'false'
  fields[20] = tail
  return fields.join(',')
}

const csv = [
  REQUIRED_COLUMNS.join(','),
  makeRow('2018-01-01', 'DFW', 'AUS', 'N12345'),
  makeRow('2018-02-01', 'DFW', 'SFO', 'N12345'),
  makeRow('2018-03-01', 'DFW', 'ORD', 'N12345'),
  makeRow('2019-01-01', 'JFK', 'LAX', 'N99999'),
  makeRow('2019-02-01', 'JFK', 'BOS', 'N99999'),
  makeRow('2019-03-01', 'DFW', 'LHR', 'N55555'),
].join('\n')

describe('sameMetalCard', () => {
  it('shows a tail number with its count', () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    render(<>{sameMetalCard.render({ model, settings: DEFAULT_SETTINGS })}</>)
    expect(screen.getByText('N12345')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('shows the caveat note about tail data recording', () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    render(<>{sameMetalCard.render({ model, settings: DEFAULT_SETTINGS })}</>)
    expect(screen.getByText(/tail data recorded/i)).toBeInTheDocument()
  })

  it('excludes tail appearing only once (below minFlights=2)', () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    render(<>{sameMetalCard.render({ model, settings: DEFAULT_SETTINGS })}</>)
    expect(screen.queryByText('N55555')).not.toBeInTheDocument()
  })
})
