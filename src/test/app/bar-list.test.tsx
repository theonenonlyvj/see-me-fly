// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BarList from '../../app/components/charts/BarList'

const rows = Array.from({ length: 14 }, (_, i) => ({ label: `R${i}`, value: 14 - i }))

describe('BarList', () => {
  it('caps at max and reveals the rest on show more', async () => {
    render(<BarList rows={rows} max={10} />)
    expect(screen.getByText('R0')).toBeInTheDocument()
    expect(screen.queryByText('R12')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /show more/i }))
    expect(screen.getByText('R12')).toBeInTheDocument()
  })
  it('no toggle when within max', () => {
    render(<BarList rows={rows.slice(0, 5)} max={10} />)
    expect(screen.queryByRole('button', { name: /show more/i })).not.toBeInTheDocument()
  })
})
