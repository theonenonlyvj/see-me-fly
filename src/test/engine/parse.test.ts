import { describe, it, expect } from 'vitest'
import { parseFlightyCsv, REQUIRED_COLUMNS } from '../../engine/parse'

const HEADER = REQUIRED_COLUMNS.join(',')

describe('parseFlightyCsv', () => {
  it('parses a minute-precision row and a second-precision row', () => {
    const csv = [
      HEADER,
      // a 2006 minute-precision row
      '2006-07-06,AAL,66,DFW,ORD,,,,,false,,2006-07-06T13:50,2006-07-06T13:55,2006-07-06T14:10,2006-07-06T14:12,2006-07-06T16:09,2006-07-06T16:05,2006-07-06T16:09,2006-07-06T16:08,Boeing 777,,,,,,,,id1,,,,,',
      // a 2022 second-precision row
      '2022-05-01,AAL,100,DFW,LAX,,,,,false,,2022-05-01T08:00:00,2022-05-01T08:05:00,2022-05-01T08:20:00,2022-05-01T08:22:00,2022-05-01T10:30:00,2022-05-01T10:25:00,2022-05-01T10:40:00,2022-05-01T10:38:00,Airbus A321,,,,,,,,id2,,,,,',
    ].join('\n')
    const { rows, headerOk } = parseFlightyCsv(csv)
    expect(headerOk).toBe(true)
    expect(rows).toHaveLength(2)
    expect(rows[0].fromCode).toBe('DFW')
    expect(rows[0].takeoffActual).toBe('2006-07-06T14:12')
    expect(rows[1].takeoffActual).toBe('2022-05-01T08:22:00')
    expect(rows[0].canceled).toBe(false)
    expect(rows[0].rawIndex).toBe(0)
    expect(rows[1].rawIndex).toBe(1)
  })

  it('reports a bad header', () => {
    const { headerOk, missingColumns } = parseFlightyCsv('foo,bar\n1,2')
    expect(headerOk).toBe(false)
    expect(missingColumns).toContain('From')
  })
})
