import { describe, it, expect } from 'vitest'
import { classifyRoute } from '../../engine/classify'
import { enrichFlight } from '../../engine/enrich'
import { parseFlightyCsv, REQUIRED_COLUMNS } from '../../engine/parse'
import { DEFAULT_DURATION_CONSTANTS as C } from '../../engine/constants'

const H = REQUIRED_COLUMNS.join(',')
const f = (from: string, to: string) =>
  enrichFlight(parseFlightyCsv([H, `2018-01-01,AAL,1,${from},${to},,,,,false,,2018-01-01T09:00,,,,,,,,Boeing 737,,,,,,,,,,,`].join('\n')).rows[0], '2026-06-25', C)

describe('classifyRoute', () => {
  it('DFW->AUS is intra-state (both US-TX)', () => {
    expect(classifyRoute(f('DFW', 'AUS'))).toBe('intra-state')
  })
  it('DFW->ORD is intra-country (US, NA)', () => {
    expect(classifyRoute(f('DFW', 'ORD'))).toBe('intra-country')
  })
  it('LHR->CDG is intra-continent (EU, different countries)', () => {
    expect(classifyRoute(f('LHR', 'CDG'))).toBe('intra-continent')
  })
  it('HNL->DFW is intercontinental (OC vs NA), not intra-USA', () => {
    expect(classifyRoute(f('HNL', 'DFW'))).toBe('intercontinental')
  })
  it('DFW->LHR is intercontinental', () => {
    expect(classifyRoute(f('DFW', 'LHR'))).toBe('intercontinental')
  })
})
