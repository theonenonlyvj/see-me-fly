// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '../../App'
import { saveCsv } from '../../app/state/csv-store'
import { REQUIRED_COLUMNS } from '../../engine/parse'

beforeEach(() => { try { localStorage.clear() } catch { /* ignore */ } })

describe('App', () => {
  it('renders the welcome prompt when nothing is saved', () => {
    render(<App />)
    expect(screen.getByText(/See-Me-Fly/i)).toBeInTheDocument()
    expect(screen.getByText(/drop your flight logs csv/i)).toBeInTheDocument()
  })

  it('auto-loads a saved CSV from localStorage (skips the dropzone)', () => {
    const csv = [
      REQUIRED_COLUMNS.join(','),
      '2018-01-01,AAL,1,DFW,AUS,,,,,false,,2018-01-01T09:00,,,,,,,,Boeing 737,,,,,,,,,,,',
    ].join('\n')
    saveCsv('mytrips.csv', csv)
    render(<App />)
    expect(screen.queryByText(/drop your flight logs csv/i)).not.toBeInTheDocument()
    expect(screen.getByText('Countries & states')).toBeInTheDocument() // a card from the loaded dashboard
  })
})
