// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { delaysCard } from '../../app/cards/DelaysCard'
import { buildModel, DEFAULT_SETTINGS } from '../../engine'
import { REQUIRED_COLUMNS } from '../../engine/parse'

// Delay = gateArrActual - gateArrSched (cols 18 & 17, 0-indexed)
// Row 1: DFW→AUS, arr sched 10:00, actual 10:05 → +5 min (on time)
// Row 2: DFW→SFO, arr sched 14:00, actual 15:30 → +90 min (late)
// REQUIRED_COLUMNS positions (0-indexed):
//   0=Date,1=Airline,2=Flight,3=From,4=To,5-8 terminals/gates,9=Canceled,10=Diverted To,
//   11=Gate Dep Sched,12=Gate Dep Actual,13=Takeoff Sched,14=Takeoff Actual,
//   15=Landing Sched,16=Landing Actual,17=Gate Arr Sched,18=Gate Arr Actual,
//   19=Aircraft Type Name,...rest blank

function makeRow(date: string, from: string, to: string, gateArrSched: string, gateArrActual: string): string {
  // Build a 33-field row with only the columns we need populated
  const fields = new Array<string>(REQUIRED_COLUMNS.length).fill('')
  fields[0]  = date
  fields[1]  = 'AAL'
  fields[2]  = '1'
  fields[3]  = from
  fields[4]  = to
  fields[9]  = 'false'
  fields[17] = gateArrSched
  fields[18] = gateArrActual
  fields[19] = 'Boeing 737'
  return fields.join(',')
}

const csv = [
  REQUIRED_COLUMNS.join(','),
  makeRow('2018-01-01', 'DFW', 'AUS', '2018-01-01T10:00', '2018-01-01T10:05'),
  makeRow('2018-02-01', 'DFW', 'SFO', '2018-02-01T14:00', '2018-02-01T15:30'),
].join('\n')

describe('delaysCard', () => {
  it('renders on-time percentage text', () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    render(<>{delaysCard.render({ model, settings: DEFAULT_SETTINGS })}</>)
    expect(screen.getByText(/on.?time/i)).toBeInTheDocument()
  })

  it('shows canceled and diverted footer', () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    render(<>{delaysCard.render({ model, settings: DEFAULT_SETTINGS })}</>)
    expect(screen.getByText(/canceled/i)).toBeInTheDocument()
    expect(screen.getByText(/diverted/i)).toBeInTheDocument()
  })
})
