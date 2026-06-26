// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import HourHistogram from '../../app/components/charts/HourHistogram'
import CalendarHeatmap from '../../app/components/charts/CalendarHeatmap'

// 24-element counts array with peak at index 8
const counts = Array.from({ length: 24 }, (_, i) => (i === 8 ? 42 : i === 14 ? 20 : 5))

describe('HourHistogram', () => {
  it('renders 24 bars', () => {
    const { container } = render(
      <HourHistogram counts={counts} accent="var(--coral)" label="Departures by hour" />
    )
    const bars = container.querySelectorAll('[data-bar]')
    expect(bars.length).toBe(24)
  })

  it('shows peak-hour caption mentioning 8 or 8am', () => {
    render(<HourHistogram counts={counts} accent="var(--coral)" />)
    const caption = screen.getByText(/8\s*am/i)
    expect(caption).toBeInTheDocument()
  })
})

describe('CalendarHeatmap', () => {
  const matrix = [
    { year: 2022, months: [3, 5, 8, 2, 10, 1, 4, 6, 3, 9, 7, 2] },
    { year: 2023, months: [6, 4, 11, 3, 8, 2, 7, 5, 9, 4, 12, 3] },
  ]

  it('renders both year labels', () => {
    render(<CalendarHeatmap matrix={matrix} accent="var(--sky)" />)
    expect(screen.getByText('2022')).toBeInTheDocument()
    expect(screen.getByText('2023')).toBeInTheDocument()
  })

  it('renders 12 cells per year row (24 total)', () => {
    const { container } = render(<CalendarHeatmap matrix={matrix} accent="var(--sky)" />)
    const cells = container.querySelectorAll('[data-cell]')
    expect(cells.length).toBe(24)
  })
})
