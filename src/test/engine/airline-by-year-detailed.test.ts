import { describe, it, expect } from 'vitest'
import { parseFlightyCsv, REQUIRED_COLUMNS } from '../../engine/parse'
import { enrichFlight } from '../../engine/enrich'
import { DEFAULT_DURATION_CONSTANTS } from '../../engine/constants'
import { airlineByYearDetailed } from '../../engine/stats'

const C = DEFAULT_DURATION_CONSTANTS
const H = REQUIRED_COLUMNS.join(',')
const mk = (line: string) => enrichFlight(parseFlightyCsv([H, line].join('\n')).rows[0], '2026-06-25', C)
const row = (date: string, from: string, to: string, airline = 'AAL') =>
  mk(`${date},${airline},1,${from},${to},,,,,false,,${date}T09:00,,,,,,,,Boeing 737-800,,,,,,,,,,,`)

describe('airlineByYearDetailed', () => {
  it('returns one row per year, sorted ascending, with per-airline counts + year totals', () => {
    const flights = [
      row('2018-01-01', 'DFW', 'AUS', 'AAL'),
      row('2018-02-01', 'DFW', 'HOU', 'AAL'),
      row('2018-03-01', 'DAL', 'HOU', 'SWA'),
      row('2019-01-01', 'DFW', 'ORD', 'UAL'),
      row('2019-02-01', 'DFW', 'ORD', 'AAL'),
    ]
    const res = airlineByYearDetailed(flights, false)
    expect(res.map((r) => r.year)).toEqual([2018, 2019])

    const y18 = res[0]
    expect(y18.total).toBe(3)
    const aa18 = y18.counts.find((c) => c.name === 'American Airlines')!
    expect(aa18.n).toBe(2)
    const sw18 = y18.counts.find((c) => c.name === 'Southwest Airlines')!
    expect(sw18.n).toBe(1)
    // counts within a year are sorted desc by n
    expect(y18.counts[0].n).toBe(2)

    const y19 = res[1]
    expect(y19.total).toBe(2)
  })

  it('carries a display name + code for each carrier', () => {
    const res = airlineByYearDetailed([row('2018-01-01', 'DFW', 'AUS', 'AAL')], false)
    const aa = res[0].counts[0]
    expect(aa.code).toBe('AAL')
    expect(aa.name).toBe('American Airlines')
  })

  it('skips unknown airlines but keeps the year (total counts only known carriers)', () => {
    // A blank airline code → airlineName resolves to "Unknown airline" and is dropped.
    const res = airlineByYearDetailed([row('2018-01-01', 'DFW', 'AUS', ''), row('2018-02-01', 'DFW', 'AUS', 'AAL')], false)
    expect(res).toHaveLength(1)
    expect(res[0].year).toBe(2018)
    expect(res[0].total).toBe(1) // only AAL counted
    expect(res[0].counts).toHaveLength(1)
    expect(res[0].counts[0].name).toBe('American Airlines')
  })

  it('when mergeDefunct is OFF, a defunct carrier stays its own carrier', () => {
    // AWE = US Airways (America West ICAO), acquired by American in 2015.
    const res = airlineByYearDetailed([row('2010-01-01', 'DFW', 'PHX', 'AWE'), row('2010-02-01', 'DFW', 'AUS', 'AAL')], false)
    expect(res[0].counts.some((c) => /US Airways|America West/i.test(c.name))).toBe(true)
    expect(res[0].counts.some((c) => c.name === 'American Airlines')).toBe(true)
    expect(res[0].counts).toHaveLength(2)
  })

  it('when mergeDefunct is ON, a defunct carrier folds into its survivor', () => {
    const res = airlineByYearDetailed([row('2010-01-01', 'DFW', 'PHX', 'AWE'), row('2010-02-01', 'DFW', 'AUS', 'AAL')], true)
    // AWE (US Airways) → AAL (American): one carrier, n=2
    expect(res[0].counts).toHaveLength(1)
    const aa = res[0].counts[0]
    expect(aa.name).toBe('American Airlines')
    expect(aa.n).toBe(2)
    expect(res[0].total).toBe(2)
  })

  it('handles an empty input', () => {
    expect(airlineByYearDetailed([], false)).toEqual([])
  })
})
