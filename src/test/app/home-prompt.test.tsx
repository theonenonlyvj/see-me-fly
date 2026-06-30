// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import App from '../../App'
import HomePrompt from '../../app/components/HomePrompt'
import { saveCsv } from '../../app/state/csv-store'
import { saveSettings } from '../../app/state/settings-store'
import { DEFAULT_SETTINGS } from '../../engine'
import { hasHome } from '../../engine/home'
import { REQUIRED_COLUMNS } from '../../engine/parse'

const csv = [
  REQUIRED_COLUMNS.join(','),
  '2018-01-01,AAL,1,DFW,AUS,,,,,false,,2018-01-01T09:00,,,,,,,,Boeing 737,,,,,,,,,,,',
].join('\n')

beforeEach(() => { try { localStorage.clear() } catch { /* ignore */ } })

describe('DEFAULT_SETTINGS home default (friend-ready)', () => {
  it('ships with home UNSET (null) so a new user has no home', () => {
    expect(DEFAULT_SETTINGS.home).toBeNull()
    expect(hasHome(DEFAULT_SETTINGS)).toBe(false)
  })
})

describe('HomePrompt component', () => {
  it('renders the prompt copy and the airport picker', () => {
    render(<HomePrompt update={vi.fn()} onSkip={vi.fn()} />)
    expect(screen.getByText(/set your home airport to unlock/i)).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Home airport' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /skip for now/i })).toBeInTheDocument()
  })

  it('picking a code calls update({ home })', () => {
    const update = vi.fn()
    render(<HomePrompt update={update} onSkip={vi.fn()} />)
    const input = screen.getByRole('textbox', { name: 'Home airport' })
    fireEvent.change(input, { target: { value: 'DFW' } })
    // Pick the DFW option from the autocomplete list (mousedown fires before blur).
    const option = screen.getByRole('button', { name: /DFW/ })
    fireEvent.mouseDown(option)
    expect(update).toHaveBeenCalledWith({ home: 'DFW' })
  })

  it('Skip for now calls onSkip', () => {
    const onSkip = vi.fn()
    render(<HomePrompt update={vi.fn()} onSkip={onSkip} />)
    fireEvent.click(screen.getByRole('button', { name: /skip for now/i }))
    expect(onSkip).toHaveBeenCalledTimes(1)
  })
})

describe('App home prompt (loaded dashboard, no home)', () => {
  it('shows the prompt when a CSV is loaded and there is no home', () => {
    saveCsv('mytrips.csv', csv)
    render(<App />)
    expect(screen.getByText(/set your home airport to unlock/i)).toBeInTheDocument()
  })

  it('Skip for now hides the prompt and it stays hidden on remount', () => {
    saveCsv('mytrips.csv', csv)
    const { unmount } = render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /skip for now/i }))
    expect(screen.queryByText(/set your home airport to unlock/i)).not.toBeInTheDocument()
    // Remount (e.g. page reload) — the dismiss flag persists, so it stays hidden.
    unmount()
    render(<App />)
    expect(screen.queryByText(/set your home airport to unlock/i)).not.toBeInTheDocument()
  })

  it('does NOT show the prompt when a home is already set', () => {
    saveCsv('mytrips.csv', csv)
    // Seed settings with a home, the way a returning owner's localStorage would.
    saveSettings({ ...DEFAULT_SETTINGS, home: 'DFW' })
    render(<App />)
    expect(screen.queryByText(/set your home airport to unlock/i)).not.toBeInTheDocument()
  })

  it('does NOT show the prompt on the initial drop-zone (no CSV)', () => {
    render(<App />)
    expect(screen.queryByText(/set your home airport to unlock/i)).not.toBeInTheDocument()
  })
})
