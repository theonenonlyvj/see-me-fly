import { describe, it, expect } from 'vitest'
import { validateCsv } from '../../app/csv/load-csv'
import { REQUIRED_COLUMNS } from '../../engine/parse'

const HEADER = REQUIRED_COLUMNS.join(',')

describe('validateCsv', () => {
  it('accepts a valid Flighty header', () => {
    const csv = [HEADER, '2018-01-01,AAL,1,DFW,AUS,,,,,false,,2018-01-01T09:00,,,,,,,,Boeing 737,,,,,,,,,,,'].join('\n')
    const r = validateCsv(csv)
    expect(r.ok).toBe(true)
    expect(r.rowCount).toBe(1)
  })
  it('rejects a non-Flighty file', () => {
    const r = validateCsv('foo,bar\n1,2')
    expect(r.ok).toBe(false)
    expect(r.missingColumns).toContain('From')
  })
})
