import { describe, it, expect } from 'vitest'
import {
  SMF_SCHEMA_VERSION,
  parseHomesCsv,
  serializeHomesCsv,
  parseLinksCsv,
  serializeLinksCsv,
  sanitizeHomeHistory,
} from '../../app/lib/see-me-fly-csv'
import type { HomeEra, GroundLink } from '../../engine/types'

describe('see-me-fly homes CSV', () => {
  it('serializes the branded header, schema_version, slash-joined airports (primary first)', () => {
    const eras: HomeEra[] = [
      { start: '2008-08-18', airports: ['RDU'], label: 'College — Durham' },
      { start: '2019-06-01', airports: ['DEN', 'SEA', 'PAE'], label: 'Moved to Denver' },
      { start: '2021-02-04', airports: ['DFW', 'DAL'] },
    ]
    const csv = serializeHomesCsv(eras)
    const lines = csv.trim().split(/\r?\n/)
    expect(lines[0]).toBe('schema_version,start_date,home_airports,label')
    expect(lines[1]).toBe(`${SMF_SCHEMA_VERSION},2008-08-18,RDU,College — Durham`)
    expect(lines[2]).toBe(`${SMF_SCHEMA_VERSION},2019-06-01,DEN/SEA/PAE,Moved to Denver`)
    // No label -> empty trailing field.
    expect(lines[3]).toBe(`${SMF_SCHEMA_VERSION},2021-02-04,DFW/DAL,`)
  })

  it('round-trips homes: parse(serialize(eras)) preserves order, airports, primary, label', () => {
    const eras: HomeEra[] = [
      { start: '2008-08-18', airports: ['RDU'], label: 'College — Durham' },
      { start: '2019-06-01', airports: ['DEN', 'SEA', 'PAE'], label: 'Moved to Denver' },
      { start: '2021-02-04', airports: ['DFW', 'DAL'], label: 'Back to Dallas' },
    ]
    const { eras: back, errors } = parseHomesCsv(serializeHomesCsv(eras))
    expect(errors).toEqual([])
    expect(back).toEqual(eras)
    expect(back[1].airports[0]).toBe('DEN') // first = primary
  })

  it('parses a hand-written homes CSV with a missing label', () => {
    const text = [
      'schema_version,start_date,home_airports,label',
      '1,2008-08-18,RDU,College — Durham',
      '1,2013-01-15,DFW/DAL,',
    ].join('\n')
    const { eras, errors } = parseHomesCsv(text)
    expect(errors).toEqual([])
    expect(eras).toEqual([
      { start: '2008-08-18', airports: ['RDU'], label: 'College — Durham' },
      { start: '2013-01-15', airports: ['DFW', 'DAL'] },
    ])
  })

  it('sanitizes malformed homes (out-of-order, duplicate-start last-wins, zero-length) and never throws', () => {
    const text = [
      'schema_version,start_date,home_airports,label',
      '1,2013-01-15,DFW/DAL,Back to Dallas', // out of order
      '1,2008-08-18,RDU,College',
      '1,2010-05-01,,Empty airports', // zero-length airports -> dropped
      '1,2008-08-18,IAD,Dup start LATER wins', // duplicate start: this should win
    ].join('\n')
    let result!: { eras: HomeEra[]; errors: string[] }
    expect(() => {
      result = parseHomesCsv(text)
    }).not.toThrow()
    // Sorted ascending, empty dropped, duplicate '2008-08-18' last wins (IAD).
    expect(result.eras).toEqual([
      { start: '2008-08-18', airports: ['IAD'], label: 'Dup start LATER wins' },
      { start: '2013-01-15', airports: ['DFW', 'DAL'], label: 'Back to Dallas' },
    ])
    // An errors[] note is surfaced about the dropped/de-duped rows.
    expect(result.errors.length).toBeGreaterThan(0)
  })
})

describe('see-me-fly homes CSV — schema/header validation (MUST-FIX 2)', () => {
  it('rejects a non-empty file missing the required homes columns (zero rows + error)', () => {
    // A Flighty-style flight CSV pasted into the homes slot: no start_date / home_airports.
    const text = ['Date,Airline,From,To', '2018-01-01,AAL,DFW,AUS'].join('\n')
    const { eras, errors } = parseHomesCsv(text)
    expect(eras).toEqual([])
    expect(errors.length).toBeGreaterThan(0)
    expect(errors.join(' ')).toMatch(/start_date|home_airports|column|header/i)
  })

  it('refuses a homes file whose schema_version is newer than supported', () => {
    const text = [
      'schema_version,start_date,home_airports,label',
      `${SMF_SCHEMA_VERSION + 1},2008-08-18,RDU,College`,
    ].join('\n')
    const { eras, errors } = parseHomesCsv(text)
    expect(eras).toEqual([])
    expect(errors.join(' ')).toMatch(/version/i)
  })

  it('still accepts a valid homes file at the current schema_version', () => {
    const text = ['schema_version,start_date,home_airports,label', '1,2008-08-18,RDU,College'].join('\n')
    const { eras, errors } = parseHomesCsv(text)
    expect(eras).toHaveLength(1)
    expect(errors).toEqual([])
  })

  it('an empty file (header only) is valid and clears to zero rows with no error', () => {
    const text = 'schema_version,start_date,home_airports,label'
    const { eras, errors } = parseHomesCsv(text)
    expect(eras).toEqual([])
    expect(errors).toEqual([])
  })
})

describe('see-me-fly links CSV — schema/header validation (MUST-FIX 2)', () => {
  it('rejects a non-empty file missing the required links columns (zero rows + error)', () => {
    const text = ['Date,Airline,From,To', '2018-01-01,AAL,DFW,AUS'].join('\n')
    const { links, errors } = parseLinksCsv(text)
    expect(links).toEqual([])
    expect(errors.length).toBeGreaterThan(0)
    expect(errors.join(' ')).toMatch(/date|from_airport|to_airport|column|header/i)
  })

  it('refuses a links file whose schema_version is newer than supported', () => {
    const text = [
      'schema_version,date,from_airport,to_airport,mode',
      `${SMF_SCHEMA_VERSION + 1},2019-06-01,COS,DEN,drive`,
    ].join('\n')
    const { links, errors } = parseLinksCsv(text)
    expect(links).toEqual([])
    expect(errors.join(' ')).toMatch(/version/i)
  })
})

describe('sanitizeHomeHistory (pure)', () => {
  it('sorts ascending by start', () => {
    const out = sanitizeHomeHistory([
      { start: '2013-01-15', airports: ['DFW'] },
      { start: '2008-08-18', airports: ['RDU'] },
    ])
    expect(out.map((e) => e.start)).toEqual(['2008-08-18', '2013-01-15'])
  })

  it('drops empty-airport eras', () => {
    const out = sanitizeHomeHistory([
      { start: '2008-08-18', airports: [] },
      { start: '2013-01-15', airports: ['DFW'] },
    ])
    expect(out).toEqual([{ start: '2013-01-15', airports: ['DFW'] }])
  })

  it('collapses duplicate starts, last wins', () => {
    const out = sanitizeHomeHistory([
      { start: '2008-08-18', airports: ['RDU'], label: 'first' },
      { start: '2008-08-18', airports: ['IAD'], label: 'second' },
    ])
    expect(out).toEqual([{ start: '2008-08-18', airports: ['IAD'], label: 'second' }])
  })

  it('is pure (does not mutate the input array)', () => {
    const input: HomeEra[] = [
      { start: '2013-01-15', airports: ['DFW'] },
      { start: '2008-08-18', airports: ['RDU'] },
    ]
    const snapshot = JSON.parse(JSON.stringify(input))
    sanitizeHomeHistory(input)
    expect(input).toEqual(snapshot)
  })
})

describe('see-me-fly links CSV', () => {
  it('serializes the branded header with schema_version + class (not klass) column', () => {
    const links: GroundLink[] = [
      { date: '2019-06-01', fromAirport: 'COS', toAirport: 'DEN', mode: 'drive' },
    ]
    const header = serializeLinksCsv(links).trim().split(/\r?\n/)[0]
    expect(header.startsWith('schema_version,')).toBe(true)
    expect(header.split(',')).toContain('class')
    expect(header.split(',')).not.toContain('klass')
    // Core fields present.
    expect(header.split(',')).toEqual(
      expect.arrayContaining(['schema_version', 'date', 'from_airport', 'to_airport', 'mode']),
    )
  })

  it('RFC-4180 round-trip: embedded commas, quotes, and a leading-zero booking ref survive', () => {
    const links: GroundLink[] = [
      {
        date: '2019-03-10',
        fromAirport: 'BOS',
        toAirport: 'IAD',
        mode: 'bus',
        fromPlace: 'Cambridge, MA',
        toPlace: 'Washington, DC',
        operator: 'Coach Lines, Inc.',
        bookingRef: '000123456789',
        klass: 'business',
        price: 49.5,
        currency: 'USD',
        note: 'He said "great seats"',
      },
    ]
    const csv = serializeLinksCsv(links)
    const { links: back, errors } = parseLinksCsv(csv)
    expect(errors).toEqual([])
    expect(back).toHaveLength(1)
    const l = back[0]
    expect(l.fromPlace).toBe('Cambridge, MA') // comma preserved, not split
    expect(l.operator).toBe('Coach Lines, Inc.')
    expect(l.note).toBe('He said "great seats"') // quotes preserved
    expect(l.bookingRef).toBe('000123456789') // string; no leading-zero loss
    expect(typeof l.bookingRef).toBe('string')
    expect(l.klass).toBe('business') // mapped back from `class` column
    expect(l.price).toBe(49.5)
    expect(l.currency).toBe('USD')
    // Full structural round-trip.
    expect(back).toEqual(links)
  })

  it('omits optional fields that are blank (only core fields present when minimal)', () => {
    const links: GroundLink[] = [
      { date: '2020-01-01', fromAirport: 'AUS', toAirport: 'DFW', mode: 'train' },
    ]
    const { links: back, errors } = parseLinksCsv(serializeLinksCsv(links))
    expect(errors).toEqual([])
    expect(back).toEqual(links)
    // No accidental undefined-but-present optional keys.
    expect(Object.keys(back[0]).sort()).toEqual(['date', 'fromAirport', 'mode', 'toAirport'])
  })

  it('keeps a price with blank currency (never invents a currency)', () => {
    const text = serializeLinksCsv([
      { date: '2021-06-01', fromAirport: 'DFW', toAirport: 'AUS', mode: 'drive', price: 30 },
    ])
    const { links, errors } = parseLinksCsv(text)
    expect(errors).toEqual([])
    expect(links[0].price).toBe(30)
    expect(links[0].currency).toBeUndefined()
  })

  it("parses a thousands-separated quoted price '1,200' to the number 1200", () => {
    const text = [
      serializeLinksCsv([{ date: '2021-06-01', fromAirport: 'DFW', toAirport: 'LAX', mode: 'drive' }])
        .trim()
        .split(/\r?\n/)[0], // header
      // hand-craft a row with a quoted thousands-separated price + currency
    ]
    // Build a real CSV row from the serializer then swap the price in to ensure header order:
    const header = text[0].split(',')
    const priceIdx = header.indexOf('price')
    const currIdx = header.indexOf('currency')
    expect(priceIdx).toBeGreaterThanOrEqual(0)
    const cells = header.map(() => '')
    cells[header.indexOf('schema_version')] = String(SMF_SCHEMA_VERSION)
    cells[header.indexOf('date')] = '2021-06-01'
    cells[header.indexOf('from_airport')] = 'DFW'
    cells[header.indexOf('to_airport')] = 'LAX'
    cells[header.indexOf('mode')] = 'drive'
    cells[priceIdx] = '"1,200"'
    cells[currIdx] = 'MXN'
    const row = cells.join(',')
    const { links, errors } = parseLinksCsv([text[0], row].join('\n'))
    expect(errors).toEqual([])
    expect(links[0].price).toBe(1200)
    expect(links[0].currency).toBe('MXN')
  })

  it('guards an unparseable price to undefined rather than NaN', () => {
    const header = serializeLinksCsv([
      { date: '2021-06-01', fromAirport: 'DFW', toAirport: 'LAX', mode: 'drive' },
    ])
      .trim()
      .split(/\r?\n/)[0]
    const cols = header.split(',')
    const cells = cols.map(() => '')
    cells[cols.indexOf('schema_version')] = String(SMF_SCHEMA_VERSION)
    cells[cols.indexOf('date')] = '2021-06-01'
    cells[cols.indexOf('from_airport')] = 'DFW'
    cells[cols.indexOf('to_airport')] = 'LAX'
    cells[cols.indexOf('mode')] = 'drive'
    cells[cols.indexOf('price')] = 'free'
    const { links } = parseLinksCsv([header, cells.join(',')].join('\n'))
    expect(links[0].price).toBeUndefined()
  })
})
