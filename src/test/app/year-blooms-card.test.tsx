// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { yearBloomsCard } from '../../app/cards/YearBloomsCard'
import YearBlooms from '../../app/components/charts/YearBlooms'
import { buildModel, DEFAULT_SETTINGS } from '../../engine'
import { REQUIRED_COLUMNS } from '../../engine/parse'

// Two flights in 2018, one in 2020 — enough to exercise multi-year small multiples.
const csv = [
  REQUIRED_COLUMNS.join(','),
  '2018-01-01,AAL,1,DFW,AUS,,,,,false,,2018-01-01T09:00,,,,,,,,Boeing 737,,,,,,,,,,,',
  '2018-03-15,AAL,2,DFW,LAX,,,,,false,,2018-03-15T09:00,,,,,,,,Boeing 737,,,,,,,,,,,',
  '2020-07-04,DAL,3,DFW,MSP,,,,,false,,2020-07-04T09:00,,,,,,,,Boeing 737,,,,,,,,,,,',
].join('\n')

describe('yearBloomsCard', () => {
  it('renders without throwing and shows the year labels', () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    render(<>{yearBloomsCard.render({ model, settings: DEFAULT_SETTINGS })}</>)
    expect(screen.getByText('2018')).toBeInTheDocument()
    expect(screen.getByText('2020')).toBeInTheDocument()
    // the honest caption
    expect(screen.getByText(/all clocks share one scale/i)).toBeInTheDocument()
  })

  it('has stable identity in the registry', () => {
    expect(yearBloomsCard.id).toBe('yearBlooms')
    expect(yearBloomsCard.group).toBe('creative')
  })
})

describe('YearBlooms chart', () => {
  it('renders one bloom (12 month bars max) per year of data', () => {
    const data = [
      { year: 2019, months: [3, 0, 2, 0, 0, 0, 1, 0, 0, 4, 0, 0] },
      { year: 2020, months: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1] },
    ]
    const { container } = render(<YearBlooms data={data} accent="var(--coral)" />)
    expect(screen.getByText('2019')).toBeInTheDocument()
    expect(screen.getByText('2020')).toBeInTheDocument()
    // one SVG per year
    expect(container.querySelectorAll('svg').length).toBe(2)
  })
})
