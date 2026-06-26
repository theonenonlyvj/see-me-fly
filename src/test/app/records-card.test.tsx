// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { recordsCard } from '../../app/cards/RecordsCard'
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

// 3 flights in one day for mostInDay, spread across months/years for busiest
// Include >100 flights to trigger a milestone
const rows = [REQUIRED_COLUMNS.join(',')]

// Jan 2018: 3 flights on same day (mostInDay)
rows.push(makeRow('2018-01-15', 'DFW', 'AUS'))
rows.push(makeRow('2018-01-15', 'AUS', 'DFW'))
rows.push(makeRow('2018-01-15', 'DFW', 'ORD'))

// Fill in enough flights to hit milestone 100
for (let i = 0; i < 100; i++) {
  const month = String((i % 12) + 1).padStart(2, '0')
  const day = String((i % 28) + 1).padStart(2, '0')
  rows.push(makeRow(`2019-${month}-${day}`, 'DFW', 'AUS'))
}

const csv = rows.join('\n')

describe('recordsCard', () => {
  it('shows busiest month or year label', () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    render(<>{recordsCard.render({ model, settings: DEFAULT_SETTINGS })}</>)
    expect(screen.getAllByText(/busiest/i).length).toBeGreaterThan(0)
  })

  it('shows most flights in a day', () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    render(<>{recordsCard.render({ model, settings: DEFAULT_SETTINGS })}</>)
    expect(screen.getByText(/most.*day|day.*most/i)).toBeInTheDocument()
  })

  it('shows 100th flight milestone', () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    render(<>{recordsCard.render({ model, settings: DEFAULT_SETTINGS })}</>)
    expect(screen.getByText(/100th/i)).toBeInTheDocument()
  })
})
