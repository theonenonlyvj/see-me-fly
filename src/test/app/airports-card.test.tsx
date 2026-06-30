// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { airportsCard } from '../../app/cards/AirportsCard'
import { buildModel, DEFAULT_SETTINGS } from '../../engine'
import { REQUIRED_COLUMNS } from '../../engine/parse'

const csv = [REQUIRED_COLUMNS.join(','),
  '2018-01-01,AAL,1,DFW,AUS,,,,,false,,2018-01-01T09:00,,,,,,,,Boeing 737,,,,,,,,,,,',
  '2018-02-01,AAL,2,DAL,AUS,,,,,false,,2018-02-01T09:00,,,,,,,,Boeing 737,,,,,,,,,,,',
].join('\n')

describe('airportsCard', () => {
  it('shows Dallas group as a top airport when grouping is on', () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    render(<>{airportsCard.render({ model, settings: DEFAULT_SETTINGS })}</>)
    // metro label always includes the member codes: "Dallas (DFW/DAL)"
    expect(screen.getByText(/Dallas \(DFW\/DAL\)/)).toBeInTheDocument()
    // a single airport always shows its code: "Austin (AUS)"
    expect(screen.getByText(/Austin \(AUS\)/)).toBeInTheDocument()
  })

  it('shows the date-aware exclusion pill copy when exclusion is on', () => {
    const s = { ...DEFAULT_SETTINGS, home: 'DFW', excludeHomeFromRankings: true }
    const model = buildModel(csv, s, '2026-06-25')
    render(<>{airportsCard.render({ model, settings: s })}</>)
    expect(screen.getByText(/Home airports excluded for the years each was home/i)).toBeInTheDocument()
  })

  it('lists the home eras on hover (title attr) for a multi-era timeline', () => {
    const s = {
      ...DEFAULT_SETTINGS,
      home: null,
      excludeHomeFromRankings: true,
      homeHistory: [
        { start: '2008-08-18', airports: ['RDU'], label: 'College' },
        { start: '2013-01-15', airports: ['DFW', 'DAL'] },
      ],
    }
    const model = buildModel(csv, s, '2026-06-25')
    const { container } = render(<>{airportsCard.render({ model, settings: s })}</>)
    const note = container.querySelector('[data-home-eras]')
    expect(note).not.toBeNull()
    const title = note!.getAttribute('title') ?? ''
    expect(title).toMatch(/RDU/)
    expect(title).toMatch(/DFW/)
    expect(title).toMatch(/2008-08-18/)
  })

  it('no exclusion pill copy when exclusion is off', () => {
    const s = { ...DEFAULT_SETTINGS, home: 'DFW', excludeHomeFromRankings: false }
    const model = buildModel(csv, s, '2026-06-25')
    render(<>{airportsCard.render({ model, settings: s })}</>)
    expect(screen.queryByText(/Home airports excluded for the years each was home/i)).toBeNull()
  })

  // MUST-FIX 1: the "Home base" pill must be DATE-AWARE and per-era. Under a prior-year scope it
  // names the home of THAT era (MKE), and a same-year flight through the most-recent home metro
  // (DFW) stays a ranked bar — never double-counted as both the pill and a bar.
  describe('date-aware home pill (multi-era)', () => {
    // Eras: MKE (2012-07-03) → DFW/DAL (2013-01-15). In 2012, MKE is home; DFW is NOT yet home.
    const eraCsv = [REQUIRED_COLUMNS.join(','),
      // 2012: a flight through MKE (the 2012 home) and a flight through DFW (a normal destination in 2012).
      '2012-08-01,AAL,10,MKE,AUS,,,,,false,,2012-08-01T09:00,,,,,,,,Boeing 737,,,,,,,,,,,',
      '2012-09-01,AAL,11,DFW,AUS,,,,,false,,2012-09-01T09:00,,,,,,,,Boeing 737,,,,,,,,,,,',
    ].join('\n')
    const eraSettings = {
      ...DEFAULT_SETTINGS,
      home: null,
      excludeHomeFromRankings: true,
      homeHistory: [
        { start: '2012-07-03', airports: ['MKE'] },
        { start: '2013-01-15', airports: ['DFW', 'DAL'] },
      ],
    }

    it('under 2012 scope the pill names the 2012 home (Milwaukee), not the most-recent home (DFW)', () => {
      const model = buildModel(eraCsv, eraSettings, '2026-06-25', 2012)
      render(<>{airportsCard.render({ model, settings: eraSettings })}</>)
      // The pill region carries the "Home base" eyebrow.
      const pillEyebrow = screen.getByText(/Home base/)
      const pill = pillEyebrow.closest('div')!
      // The pill names Milwaukee (the 2012 era's home), with its code.
      expect(pill.textContent).toMatch(/Milwaukee \(MKE\)/)
      // It does NOT name Dallas (DFW only became home in 2013).
      expect(pill.textContent).not.toMatch(/Dallas/)
    })

    it('ALL-TIME collapses the multi-era home bases into ONE cohesive "Home bases" row (no swarm)', () => {
      // All-time: a 2012 MKE flight (MKE home then) AND a 2014 DFW flight (DFW home by 2013) → two
      // distinct excluded home bases that must collapse into ONE cohesive row, not two pills.
      const allTimeCsv = [REQUIRED_COLUMNS.join(','),
        '2012-08-01,AAL,10,MKE,AUS,,,,,false,,2012-08-01T09:00,,,,,,,,Boeing 737,,,,,,,,,,,',
        '2014-08-01,AAL,12,DFW,AUS,,,,,false,,2014-08-01T09:00,,,,,,,,Boeing 737,,,,,,,,,,,',
      ].join('\n')
      const model = buildModel(allTimeCsv, eraSettings, '2026-06-25')
      render(<>{airportsCard.render({ model, settings: eraSettings })}</>)
      // Exactly ONE home eyebrow, and it's the plural "Home bases" cohesive row (not N "Home base" pills).
      expect(screen.queryAllByText(/^Home base$/)).toHaveLength(0)
      const eyebrows = screen.getAllByText(/^Home bases$/)
      expect(eyebrows).toHaveLength(1)
      const row = eyebrows[0].closest('div')!.parentElement!
      // The current (most-recent) base leads; the earlier base is listed compactly in the same row.
      expect(row.textContent).toMatch(/Dallas/)     // current home leads
      expect(row.textContent).toMatch(/Milwaukee/)  // earlier home listed
      expect(row.textContent).toMatch(/earlier/)    // compact "+ earlier:" listing
    })

    it('DFW stays a ranked bar in 2012 (not pulled into the pill) — no double-count', () => {
      const model = buildModel(eraCsv, eraSettings, '2026-06-25', 2012)
      // byAirport (ranked bars) must still contain the Dallas group for the 2012 DFW flight.
      const dallasBar = model.byAirport.find((a) => a.key === 'Dallas')
      expect(dallasBar?.count).toBe(1)
      // MKE must be excluded from the ranked bars (it's the 2012 home).
      expect(model.byAirport.find((a) => a.key === 'MKE')).toBeUndefined()
      // Exactly one pill renders (the single excluded era-home), and it is Milwaukee with count 1.
      render(<>{airportsCard.render({ model, settings: eraSettings })}</>)
      const eyebrows = screen.getAllByText(/^Home base$/)
      expect(eyebrows).toHaveLength(1)
      const pill = eyebrows[0].closest('div')!
      expect(pill.textContent).toMatch(/Milwaukee \(MKE\)/)
      // pill count = 1 (the single 2012 MKE endpoint that byAirport dropped)
      expect(pill.textContent).toMatch(/\b1\b/)
    })
  })
})
