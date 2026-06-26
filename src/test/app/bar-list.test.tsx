// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BarList from '../../app/components/charts/BarList'

afterEach(cleanup)

const rows = Array.from({ length: 25 }, (_, i) => ({ label: `R${i}`, value: 25 - i }))

describe('BarList', () => {
  it('caps at max, then "Show 10 more" reveals the next 10', async () => {
    render(<BarList rows={rows} max={10} />)
    expect(screen.getByText('R0')).toBeInTheDocument()
    expect(screen.queryByText('R10')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /show 10 more/i }))
    expect(screen.getByText('R19')).toBeInTheDocument()
    expect(screen.queryByText('R20')).not.toBeInTheDocument()
  })

  it('"Show all" reveals everything, and "Show less" collapses back to max', async () => {
    render(<BarList rows={rows} max={10} />)
    await userEvent.click(screen.getByRole('button', { name: /show all/i }))
    expect(screen.getByText('R24')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /show less/i }))
    expect(screen.queryByText('R10')).not.toBeInTheDocument()
  })

  it('no toggle when within max', () => {
    render(<BarList rows={rows.slice(0, 5)} max={10} />)
    expect(screen.queryByRole('button', { name: /show/i })).not.toBeInTheDocument()
  })

  it('resets expansion when the rows prop shrinks (no stale "Show less")', async () => {
    const big = Array.from({ length: 25 }, (_, i) => ({ label: `R${i}`, value: 25 - i }))
    const small = Array.from({ length: 8 }, (_, i) => ({ label: `S${i}`, value: 8 - i }))
    const { rerender } = render(<BarList rows={big} max={10} />)
    await userEvent.click(screen.getByRole('button', { name: /show all/i }))
    expect(screen.getByText('R24')).toBeInTheDocument()
    rerender(<BarList rows={small} max={10} />)
    expect(screen.queryByRole('button', { name: /show less/i })).not.toBeInTheDocument()
  })

  it('expands a row\'s nested sub-rows on click', async () => {
    const withSub = [{ label: 'United States', value: 100, sub: '(2 states)', subRows: [{ label: 'Texas', value: 60 }, { label: 'California', value: 40 }] }]
    render(<BarList rows={withSub} max={10} />)
    expect(screen.queryByText('Texas')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /2 states/i }))
    expect(screen.getByText('Texas')).toBeInTheDocument()
    expect(screen.getByText('California')).toBeInTheDocument()
  })
})
