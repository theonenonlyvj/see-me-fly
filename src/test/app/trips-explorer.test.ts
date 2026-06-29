// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { routePath } from '../../app/cards/TripsExplorerCard'
import type { Trip } from '../../engine/stats'

const mk = (...codes: [string, string][]): Trip =>
  ({ flights: codes.map(([fromCode, toCode]) => ({ fromCode, toCode })) }) as unknown as Trip

describe('routePath (trips explorer label)', () => {
  it('marks a ground airport-switch with a slash (arrived LGA, left from JFK)', () => {
    expect(routePath(mk(['DAL', 'MDW'], ['MDW', 'DCA'], ['DCA', 'LGA'], ['JFK', 'DFW'])))
      .toBe('DAL-MDW-DCA-LGA/JFK-DFW')
  })
  it('collapses matching connections into one airport', () => {
    expect(routePath(mk(['DFW', 'ORD'], ['ORD', 'LHR']))).toBe('DFW-ORD-LHR')
  })
  it('renders a single leg as from-to', () => {
    expect(routePath(mk(['DFW', 'AUS']))).toBe('DFW-AUS')
  })
  it('handles a simple out-and-back', () => {
    expect(routePath(mk(['DFW', 'AUS'], ['AUS', 'DFW']))).toBe('DFW-AUS-DFW')
  })
})
