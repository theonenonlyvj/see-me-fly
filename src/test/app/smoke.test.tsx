// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '../../App'

describe('App', () => {
  it('renders the welcome prompt', () => {
    render(<App />)
    expect(screen.getByText(/Flight Visualizer/i)).toBeInTheDocument()
    expect(screen.getByText(/drop your flight logs csv/i)).toBeInTheDocument()
  })
})
