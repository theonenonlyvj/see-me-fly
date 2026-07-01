// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { rangeBloomCard } from '../../app/cards/RangeBloomCard'
import RangeBloom from '../../app/components/charts/RangeBloom'
import { buildModel, DEFAULT_SETTINGS } from '../../engine'
import { REQUIRED_COLUMNS } from '../../engine/parse'
import type { Settings } from '../../engine'
import type { RangeBloomDestination } from '../../engine/stats'

// Flights OUT from DFW to a spread of destinations across continents (so several legend rows show).
const csv = [
  REQUIRED_COLUMNS.join(','),
  '2018-03-01,AAL,1,DFW,LGA,,,,,false,,2018-03-01T09:00,,,,,,,,Boeing 737,,,,,,,,,,,',
  '2018-05-01,AAL,2,DFW,LGA,,,,,false,,2018-05-01T09:00,,,,,,,,Boeing 737,,,,,,,,,,,', // 2nd LGA visit
  '2019-06-01,AAL,3,DFW,LHR,,,,,false,,2019-06-01T09:00,,,,,,,,Boeing 777,,,,,,,,,,,', // Europe
  '2020-07-01,AAL,4,DFW,SYD,,,,,false,,2020-07-01T09:00,,,,,,,,Boeing 787,,,,,,,,,,,', // Oceania, farthest
  '2021-01-01,AAL,5,DFW,LAX,,,,,false,,2021-01-01T09:00,,,,,,,,Boeing 737,,,,,,,,,,,', // N. America
].join('\n')

const HOME: Settings = { ...DEFAULT_SETTINGS, home: 'DFW' }

describe('rangeBloomCard', () => {
  it('renders the bloom with a home set: continent legend + honesty caption, no throw', () => {
    const model = buildModel(csv, HOME, '2026-06-25')
    render(<>{rangeBloomCard.render({ model, settings: HOME })}</>)
    expect(screen.getByRole('heading', { name: /Home-anchored range bloom/i })).toBeInTheDocument()
    expect(screen.getByText(/Bearing & reach from home/i)).toBeInTheDocument()
    // At least one continent legend label appears (destinations span NA/EU/OC).
    expect(screen.getByText(/N\. America/i)).toBeInTheDocument()
    expect(screen.getByText(/Europe/i)).toBeInTheDocument()
    // size legend + sqrt-scale caption (honesty)
    expect(screen.getByText(/Dot area = visit count/i)).toBeInTheDocument()
    expect(screen.getByText(/√-distance scale/i)).toBeInTheDocument()
    // the polar svg rendered
    expect(document.querySelector('svg[aria-label*="destinations"]')).toBeTruthy()
  })

  it('renders a gentle no-home empty state (no dots) when no home is configured', () => {
    const noHome: Settings = { ...DEFAULT_SETTINGS, home: null, homeHistory: [] }
    const model = buildModel(csv, noHome, '2026-06-25')
    render(<>{rangeBloomCard.render({ model, settings: noHome })}</>)
    expect(screen.getByRole('heading', { name: /Home-anchored range bloom/i })).toBeInTheDocument()
    expect(screen.getByText(/Set your home airport/i)).toBeInTheDocument()
    // no polar chart when there's no home
    expect(document.querySelector('svg[aria-label*="destinations"]')).toBeNull()
  })

  it('has stable identity in the registry', () => {
    expect(rangeBloomCard.id).toBe('rangeBloom')
    expect(rangeBloomCard.group).toBe('creative')
  })
})

describe('RangeBloom chart', () => {
  const dests: RangeBloomDestination[] = [
    { code: 'SYD', name: 'Sydney', municipality: 'Sydney', continent: 'OC', bearing: 250, distanceMi: 8578, visits: 1 },
    { code: 'LGA', name: 'LaGuardia', municipality: 'New York', continent: 'NA', bearing: 55, distanceMi: 1380, visits: 40 },
    { code: 'LHR', name: 'Heathrow', municipality: 'London', continent: 'EU', bearing: 40, distanceMi: 4740, visits: 5 },
  ]

  it('draws a dot per destination + the farthest annotation, without throwing', () => {
    render(<RangeBloom destinations={dests} farthest={dests[0]} homeLabel="DFW" />)
    // annotation lands on SYD as the longest reach
    expect(screen.getByText(/SYD — 8,578 mi/)).toBeInTheDocument()
    expect(screen.getByText(/your longest reach/i)).toBeInTheDocument()
    // home label at center
    expect(screen.getByText(/HOME · DFW/)).toBeInTheDocument()
    // at least 3 destination circles rendered (plus rings/home) — assert the svg has circles
    expect(document.querySelectorAll('circle').length).toBeGreaterThanOrEqual(3)
  })

  it('handles a single destination without throwing', () => {
    const one: RangeBloomDestination[] = [dests[0]]
    render(<RangeBloom destinations={one} farthest={one[0]} homeLabel="DFW" />)
    expect(screen.getByText(/SYD — 8,578 mi/)).toBeInTheDocument()
  })
})
