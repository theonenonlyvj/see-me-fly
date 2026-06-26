// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import CardFrame from '../../app/components/CardFrame'

describe('CardFrame', () => {
  it('renders title + children', () => {
    render(<CardFrame title="Overview">hi</CardFrame>)
    expect(screen.getByRole('heading', { name: 'Overview' })).toBeInTheDocument()
    expect(screen.getByText('hi')).toBeInTheDocument()
  })
})
