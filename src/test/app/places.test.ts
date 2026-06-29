import { describe, it, expect } from 'vitest'
import { homeKey, displayEndpoint, displayRoute, displayRouteString } from '../../app/lib/places'
import { DEFAULT_SETTINGS, type Settings } from '../../engine'

const S = (over: Partial<Settings> = {}): Settings => ({ ...DEFAULT_SETTINGS, ...over })

describe('places helpers', () => {
  it('homeKey resolves to the metro group name when grouping is on', () => {
    expect(homeKey(S({ home: 'DFW', groupAirports: true }))).toBe('Dallas')
    expect(homeKey(S({ home: 'DFW', groupAirports: false }))).toBe('DFW')
    expect(homeKey(S({ home: null }))).toBeNull()
  })

  it('displayEndpoint appends member codes for a metro and city+code for an airport', () => {
    expect(displayEndpoint('Dallas')).toBe('Dallas (DFW/DAL)')
    expect(displayEndpoint('AUS')).toMatch(/\(AUS\)$/) // "Austin (AUS)" — code always shown
    expect(displayEndpoint('AUS')).not.toBe('AUS')     // city prefix present
  })

  it('orders home first for an undirected route', () => {
    const p = displayRoute('AUS↔Dallas', S({ home: 'DFW', groupAirports: true }))
    expect(p?.left).toBe('Dallas (DFW/DAL)')
    expect(p?.right).toMatch(/\(AUS\)$/)
    expect(p?.sep).toBe('↔')
  })

  it('never reverses a directed route, but still decorates endpoints', () => {
    const p = displayRoute('AUS→Dallas', S({ home: 'DFW', groupAirports: true }))
    expect(p?.left).toMatch(/\(AUS\)$/)
    expect(p?.right).toBe('Dallas (DFW/DAL)')
    expect(p?.directed).toBe(true)
  })

  it('displayRouteString joins the decorated home-first label', () => {
    expect(displayRouteString('AUS↔Dallas', S({ home: 'DFW', groupAirports: true }))).toMatch(/^Dallas \(DFW\/DAL\) ↔ .*\(AUS\)$/)
  })

  it('a non-route string is returned unchanged', () => {
    expect(displayRoute('nonsense', S())).toBeNull()
    expect(displayRouteString('nonsense', S())).toBe('nonsense')
  })

  it('orders home first when the home endpoint is in the homeKeys UNION (an earlier era)', () => {
    // Two home eras: RDU (college) then DFW (present). A RDU↔AUS route should still
    // lead with RDU even though it was only home in an earlier era — the union covers it.
    const s = S({
      home: null,
      homeHistory: [
        { start: '2008-08-18', airports: ['RDU'] },
        { start: '2013-01-15', airports: ['DFW', 'DAL'] },
      ],
    })
    const p = displayRoute('AUS↔RDU', s)
    expect(p?.left).toMatch(/\(RDU\)$/)
    expect(p?.right).toMatch(/\(AUS\)$/)
  })

  it('breaks a both-home route tie toward the most-recent primaryKey', () => {
    // Both endpoints were home in some era; the more-recent primary (DFW group) leads.
    const s = S({
      groupAirports: true,
      home: null,
      homeHistory: [
        { start: '2008-08-18', airports: ['RDU'] },
        { start: '2013-01-15', airports: ['DFW', 'DAL'] },
      ],
    })
    // key form: "RDU↔Dallas" — both are home keys; primaryKey = Dallas → Dallas leads.
    const p = displayRoute('RDU↔Dallas', s)
    expect(p?.left).toBe('Dallas (DFW/DAL)')
    expect(p?.right).toMatch(/\(RDU\)$/)
  })

  it('still works with the legacy single home (backward compat)', () => {
    const p = displayRoute('AUS↔Dallas', S({ home: 'DFW', groupAirports: true }))
    expect(p?.left).toBe('Dallas (DFW/DAL)')
    expect(p?.right).toMatch(/\(AUS\)$/)
  })
})
