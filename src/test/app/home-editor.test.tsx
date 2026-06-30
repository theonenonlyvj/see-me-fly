// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { DEFAULT_SETTINGS, type Settings } from '../../engine'
import HomeHistoryEditor from '../../app/components/home/HomeHistoryEditor'
import GroundLinksEditor from '../../app/components/home/GroundLinksEditor'
import SettingsPanel from '../../app/components/SettingsPanel'
import AirportPicker from '../../app/components/home/AirportPicker'
import { airportLabel } from '../../app/lib/airport-search'
import { serializeHomesCsv, serializeLinksCsv } from '../../app/lib/see-me-fly-csv'

function settings(over: Partial<Settings> = {}): Settings {
  return { ...DEFAULT_SETTINGS, ...over }
}

describe('HomeHistoryEditor', () => {
  it('starts empty and is clearly optional (no eras → empty-state hint, single-home default stays)', () => {
    const onChange = vi.fn()
    render(<HomeHistoryEditor homeHistory={[]} groupAirports={true} onChange={onChange} />)
    // empty-state copy mentions it's optional
    expect(screen.getByText(/optional/i)).toBeInTheDocument()
  })

  it('adding an era writes back via onChange', () => {
    const onChange = vi.fn()
    render(<HomeHistoryEditor homeHistory={[]} groupAirports={true} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /add (home )?era/i }))
    expect(onChange).toHaveBeenCalledTimes(1)
    const arg = onChange.mock.calls[0][0] as { start: string; airports: string[] }[]
    expect(arg).toHaveLength(1)
  })

  it('surfaces an ascending-date validation when starts are out of order', () => {
    const onChange = vi.fn()
    render(
      <HomeHistoryEditor
        homeHistory={[
          { start: '2013-01-15', airports: ['DFW'] },
          { start: '2008-08-18', airports: ['RDU'] },
        ]}
        groupAirports={true}
        onChange={onChange}
      />,
    )
    expect(screen.getByText(/ascending|out of order|order/i)).toBeInTheDocument()
  })

  it('surfaces a "need at least one airport" validation for an empty era', () => {
    const onChange = vi.fn()
    render(
      <HomeHistoryEditor
        homeHistory={[{ start: '2008-08-18', airports: [] }]}
        groupAirports={true}
        onChange={onChange}
      />,
    )
    expect(screen.getByText(/at least one airport/i)).toBeInTheDocument()
  })

  it('warns (non-blocking) when one era spans more than one airport group with grouping on', () => {
    const onChange = vi.fn()
    render(
      <HomeHistoryEditor
        homeHistory={[{ start: '2019-06-01', airports: ['DEN', 'SEA'] }]}
        groupAirports={true}
        onChange={onChange}
      />,
    )
    // DEN (Denver) and SEA (Seattle) are different airportKey groups → warn
    expect(screen.getByText(/more than one|multiple|different.*group/i)).toBeInTheDocument()
  })

  it('removing an era writes the shorter list back', () => {
    const onChange = vi.fn()
    render(
      <HomeHistoryEditor
        homeHistory={[
          { start: '2008-08-18', airports: ['RDU'] },
          { start: '2013-01-15', airports: ['DFW'] },
        ]}
        groupAirports={true}
        onChange={onChange}
      />,
    )
    const removeButtons = screen.getAllByRole('button', { name: /remove|delete/i })
    fireEvent.click(removeButtons[0])
    expect(onChange).toHaveBeenCalled()
    const arg = onChange.mock.calls.at(-1)![0] as unknown[]
    expect(arg).toHaveLength(1)
  })
})

describe('GroundLinksEditor', () => {
  it('a ground link with a price but blank currency shows the currency validation', () => {
    const onChange = vi.fn()
    render(
      <GroundLinksEditor
        groundLinks={[{ date: '2019-06-01', fromAirport: 'COS', toAirport: 'DEN', mode: 'drive', price: 120 }]}
        onChange={onChange}
      />,
    )
    expect(screen.getByText(/currency.*required|requires? a currency|currency when/i)).toBeInTheDocument()
  })

  it('no currency validation when price is unset', () => {
    const onChange = vi.fn()
    render(
      <GroundLinksEditor
        groundLinks={[{ date: '2019-06-01', fromAirport: 'COS', toAirport: 'DEN', mode: 'drive' }]}
        onChange={onChange}
      />,
    )
    expect(screen.queryByText(/currency.*required|requires? a currency|currency when/i)).not.toBeInTheDocument()
  })

  it('adding a link writes back via onChange', () => {
    const onChange = vi.fn()
    render(<GroundLinksEditor groundLinks={[]} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /add (ground )?link/i }))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect((onChange.mock.calls[0][0] as unknown[])).toHaveLength(1)
  })
})

describe('serializers (export source)', () => {
  it('serializeHomesCsv / serializeLinksCsv produce non-empty CSV text', () => {
    const homes = serializeHomesCsv([{ start: '2008-08-18', airports: ['RDU'], label: 'College' }])
    expect(homes).toContain('start_date')
    expect(homes).toContain('RDU')
    const links = serializeLinksCsv([{ date: '2019-06-01', fromAirport: 'COS', toAirport: 'DEN', mode: 'drive' }])
    expect(links).toContain('from_airport')
    expect(links).toContain('COS')
  })
})

describe('SettingsPanel — import/export wiring', () => {
  beforeEach(() => {
    // jsdom doesn't implement createObjectURL / anchor.click downloads.
    if (!('createObjectURL' in URL)) {
      ;(URL as unknown as { createObjectURL: () => string }).createObjectURL = () => 'blob:mock'
    }
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock')
    if (!('revokeObjectURL' in URL)) {
      ;(URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = () => {}
    }
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  })

  function renderPanel(over: Partial<Settings> = {}) {
    const update = vi.fn()
    render(
      <SettingsPanel
        settings={settings(over)}
        update={update}
        reset={() => {}}
        onReplace={() => {}}
        flown={[]}
      />,
    )
    return update
  }

  it('renders the single-home default when homeHistory is empty', () => {
    renderPanel()
    expect(screen.getByText(/Home base/i)).toBeInTheDocument()
  })

  it('"Download my see-me-fly data" triggers a download (createObjectURL called)', () => {
    renderPanel({ homeHistory: [{ start: '2008-08-18', airports: ['RDU'] }] })
    const btn = screen.getByRole('button', { name: /download my see-me-fly data/i })
    fireEvent.click(btn)
    expect(URL.createObjectURL).toHaveBeenCalled()
  })

  it('importing a homes CSV populates settings + shows a post-import summary count', async () => {
    const update = renderPanel()
    // expand the optional home-timeline section to reach the import controls
    fireEvent.click(screen.getByRole('button', { name: /home timeline & ground links/i }))
    const csv = serializeHomesCsv([
      { start: '2008-08-18', airports: ['RDU'], label: 'College' },
      { start: '2013-01-15', airports: ['DFW', 'DAL'] },
    ])
    const file = new File([csv], 'see-me-fly_homes.csv', { type: 'text/csv' })
    // find the homes file input
    const input = document.querySelector('input[data-testid="import-homes"]') as HTMLInputElement
    expect(input).toBeTruthy()
    Object.defineProperty(input, 'files', { value: [file] })
    fireEvent.change(input)
    // settings written with the imported eras
    await screen.findByText(/imported/i)
    const calledWithHomes = update.mock.calls.some(
      (c) => Array.isArray((c[0] as Partial<Settings>).homeHistory) && (c[0] as Partial<Settings>).homeHistory!.length === 2,
    )
    expect(calledWithHomes).toBe(true)
    // summary shows a count
    expect(screen.getByText(/2\s+(home )?era/i)).toBeInTheDocument()
  })

  // MUST-FIX 2: a malformed / wrong-shape import must NEVER wipe the existing timeline.
  it('importing a flight-style CSV into the homes slot leaves homeHistory UNCHANGED and shows an error', async () => {
    // homeHistory non-empty → the timeline section (with the import controls) starts expanded.
    const update = renderPanel({ homeHistory: [{ start: '2008-08-18', airports: ['RDU'] }] })
    // A Flighty-style flight CSV (no start_date / home_airports columns).
    const badCsv = ['Date,Airline,From,To', '2018-01-01,AAL,DFW,AUS'].join('\n')
    const file = new File([badCsv], 'flights.csv', { type: 'text/csv' })
    const input = document.querySelector('input[data-testid="import-homes"]') as HTMLInputElement
    Object.defineProperty(input, 'files', { value: [file] })
    fireEvent.change(input)
    await screen.findByRole('status')
    // homeHistory must NOT be written (no update with a homeHistory patch at all).
    const wroteHomes = update.mock.calls.some((c) => 'homeHistory' in (c[0] as Partial<Settings>))
    expect(wroteHomes).toBe(false)
    // An error is surfaced in the post-import summary.
    expect(screen.getByText(/column|header|start_date|home_airports|could not|invalid/i)).toBeInTheDocument()
  })

  it('refuses a homes CSV with a newer schema_version (no wipe, error shown)', async () => {
    const update = renderPanel({ homeHistory: [{ start: '2008-08-18', airports: ['RDU'] }] })
    const text = ['schema_version,start_date,home_airports,label', '2,2008-08-18,RDU,College'].join('\n')
    const file = new File([text], 'homes.csv', { type: 'text/csv' })
    const input = document.querySelector('input[data-testid="import-homes"]') as HTMLInputElement
    Object.defineProperty(input, 'files', { value: [file] })
    fireEvent.change(input)
    await screen.findByRole('status')
    const wroteHomes = update.mock.calls.some((c) => 'homeHistory' in (c[0] as Partial<Settings>))
    expect(wroteHomes).toBe(false)
    expect(screen.getByText(/version/i)).toBeInTheDocument()
  })
})

// MUST-FIX 3: a stable-keyed AirportPicker is reused across re-renders (e.g. after an import),
// so it must mirror an EXTERNALLY-changed `value` prop, not keep the stale seeded text.
describe('AirportPicker — external value resync', () => {
  it('reflects a changed `value` prop after mount (input text follows the new code)', () => {
    const { rerender } = render(<AirportPicker value="DFW" onChange={() => {}} ariaLabel="home airport" />)
    const input = screen.getByLabelText('home airport') as HTMLInputElement
    expect(input.value).toBe(airportLabel('DFW'))
    // External change (e.g. an import swapped the stored code) — the input must follow.
    rerender(<AirportPicker value="DEN" onChange={() => {}} ariaLabel="home airport" />)
    expect(input.value).toBe(airportLabel('DEN'))
    expect(input.value).toMatch(/DEN/)
  })

  it('clears the input when `value` is reset to empty externally', () => {
    const { rerender } = render(<AirportPicker value="DFW" onChange={() => {}} ariaLabel="home airport" />)
    const input = screen.getByLabelText('home airport') as HTMLInputElement
    rerender(<AirportPicker value="" onChange={() => {}} ariaLabel="home airport" />)
    expect(input.value).toBe('')
  })
})

// Keep `within` import used to satisfy lint if a future assertion needs it.
void within
