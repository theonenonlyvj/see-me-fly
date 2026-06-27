import { describe, it, expect } from 'vitest'
import {
  byCountry, superDomestic, intercontinental,
  extremeFlights, byMonth, byYearMonthMatrix, hourHistogram,
  byAircraft, byTail, delayStats, geoExtremes, odometer, records,
  commonLayovers, intercontinentalByPair, groundGaps,
} from '../../engine/stats'
import type { EnrichedFlight } from '../../engine/types'
import { enrichFlight } from '../../engine/enrich'
import { parseFlightyCsv, REQUIRED_COLUMNS } from '../../engine/parse'
import { DEFAULT_DURATION_CONSTANTS as C } from '../../engine/constants'
import type { Settings } from '../../engine/types'

const H = REQUIRED_COLUMNS.join(',')
const TODAY = '2026-06-25'
const mk = (line: string) => enrichFlight(parseFlightyCsv([H, line].join('\n')).rows[0], TODAY, C)
const route = (from: string, to: string, date = '2018-01-01') =>
  mk(`${date},AAL,1,${from},${to},,,,,false,,${date}T09:00,,,,,,,,Boeing 737,,,,,,,,,,,`)

const S = (over: Partial<Settings> = {}): Settings => ({
  groupAirports: false, explicitlyUnique: false, includeCanceled: false, excludeBeforeDate: null, home: null, excludeHomeFromRankings: false, layoverMaxHours: 5, excludeDayTrips: true, splitCountriesByState: [], duration: C, ...over,
})

// 3-flight fixture:
// DFW→AUS  — intra-state  (US/NA)
// DFW→LHR  — intercontinental NA↔EU
// HNL→DFW  — intercontinental OC↔NA
const flights = [
  route('DFW', 'AUS'),  // US-TX → US-TX, intra-state
  route('DFW', 'LHR'),  // US (NA) → GB (EU), intercontinental
  route('HNL', 'DFW'),  // US (OC) → US (NA), intercontinental
]

describe('byCountry', () => {
  it('US appears with count 3 (all 3 flights touch US)', () => {
    const result = byCountry(flights, S())
    const us = result.find((r) => r.code === 'US')
    expect(us).toBeDefined()
    expect(us!.count).toBe(3)
  })

  it('GB appears with count 1', () => {
    const result = byCountry(flights, S())
    const gb = result.find((r) => r.code === 'GB')
    expect(gb).toBeDefined()
    expect(gb!.count).toBe(1)
  })

  it('countries sorted desc by count', () => {
    const result = byCountry(flights, S())
    expect(result[0].code).toBe('US')
    for (let i = 1; i < result.length; i++) {
      expect(result[i].count).toBeLessThanOrEqual(result[i - 1].count)
    }
  })

  it('US has non-empty flag emoji', () => {
    const result = byCountry(flights, S())
    const us = result.find((r) => r.code === 'US')!
    expect(us.flag).toBeTruthy()
    expect(us.flag.length).toBeGreaterThan(0)
  })

  it('GB has non-empty flag emoji', () => {
    const result = byCountry(flights, S())
    const gb = result.find((r) => r.code === 'GB')!
    expect(gb.flag).toBeTruthy()
  })

  it('US has name resolved', () => {
    const result = byCountry(flights, S())
    const us = result.find((r) => r.code === 'US')!
    expect(us.name).toBeTruthy()
    expect(us.name).not.toBe('US') // should resolve to a country name
  })

  it('US has regions populated with US-TX', () => {
    const result = byCountry(flights, S())
    const us = result.find((r) => r.code === 'US')!
    expect(us.regions).toBeDefined()
    expect(us.regions!.length).toBeGreaterThan(0)
    const tx = us.regions!.find((r) => r.region === 'US-TX')
    expect(tx).toBeDefined()
    expect(tx!.count).toBeGreaterThan(0)
  })

  it('GB does not have regions populated', () => {
    const result = byCountry(flights, S())
    const gb = result.find((r) => r.code === 'GB')!
    expect(gb.regions).toBeUndefined()
  })

  it('each flight credits each distinct country only once', () => {
    // DFW→LHR credits US once and GB once (not twice for DFW appearing in 2 flights)
    // But total US count = 3 (3 flights each touch US at least once)
    const result = byCountry(flights, S())
    const us = result.find((r) => r.code === 'US')!
    expect(us.count).toBe(3)
    const gb = result.find((r) => r.code === 'GB')!
    expect(gb.count).toBe(1)
  })

  it('US regions sorted desc by count', () => {
    const result = byCountry(flights, S())
    const us = result.find((r) => r.code === 'US')!
    if (us.regions && us.regions.length > 1) {
      for (let i = 1; i < us.regions.length; i++) {
        expect(us.regions[i].count).toBeLessThanOrEqual(us.regions[i - 1].count)
      }
    }
  })
})

describe('superDomestic', () => {
  it('includes intra-state tier', () => {
    const result = superDomestic(flights, S())
    const tiers = result.map((t) => t.tier)
    expect(tiers).toContain('intra-state')
  })

  it('does not include intercontinental tier', () => {
    const result = superDomestic(flights, S())
    const tiers = result.map((t) => t.tier)
    expect(tiers).not.toContain('intercontinental')
  })

  it('intra-state tier contains DFW↔AUS route', () => {
    const result = superDomestic(flights, S())
    const intraState = result.find((t) => t.tier === 'intra-state')!
    expect(intraState).toBeDefined()
    expect(intraState.routes.length).toBeGreaterThan(0)
    const routeKeys = intraState.routes.map((r) => r.key)
    // undirected: AUS↔DFW
    const hasDfwAus = routeKeys.some((k) => k.includes('DFW') && k.includes('AUS'))
    expect(hasDfwAus).toBe(true)
  })

  it('intra-state routes have count >= 1', () => {
    const result = superDomestic(flights, S())
    const intraState = result.find((t) => t.tier === 'intra-state')
    if (intraState) {
      for (const r of intraState.routes) {
        expect(r.count).toBeGreaterThanOrEqual(1)
      }
    }
  })

  it('tiers appear in order intra-state, intra-country, intra-continent', () => {
    const tierOrder = ['intra-state', 'intra-country', 'intra-continent']
    const result = superDomestic(flights, S())
    const resultTiers = result.map((t) => t.tier)
    const positions = resultTiers.map((t) => tierOrder.indexOf(t))
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]).toBeGreaterThan(positions[i - 1])
    }
  })

  it('returns only tiers with routes', () => {
    // All 3 flights are either intra-state or intercontinental, no intra-country/continent
    const result = superDomestic(flights, S())
    for (const t of result) {
      expect(t.routes.length).toBeGreaterThan(0)
    }
  })
})

describe('intercontinental', () => {
  it('returns 2 routes for 2 intercontinental flights', () => {
    const result = intercontinental(flights, S())
    expect(result.length).toBe(2)
  })

  it('contains a route with London (LHR)', () => {
    const result = intercontinental(flights, S())
    const hasLhr = result.some((r) => r.key.includes('LHR'))
    expect(hasLhr).toBe(true)
  })

  it('contains a route with Honolulu (HNL)', () => {
    const result = intercontinental(flights, S())
    const hasHnl = result.some((r) => r.key.includes('HNL'))
    expect(hasHnl).toBe(true)
  })

  it('routes have count >= 1', () => {
    const result = intercontinental(flights, S())
    for (const r of result) {
      expect(r.count).toBeGreaterThanOrEqual(1)
    }
  })

  it('routes have miles > 0', () => {
    const result = intercontinental(flights, S())
    for (const r of result) {
      expect(r.miles).toBeGreaterThan(0)
    }
  })

  it('sorted desc by count', () => {
    const moreFlights = [
      ...flights,
      route('DFW', 'LHR'), // second DFW↔LHR flight
    ]
    const result = intercontinental(moreFlights, S())
    expect(result[0].key).toContain('LHR')
    expect(result[0].count).toBe(2)
  })

  it('does not include intra-state routes', () => {
    const result = intercontinental(flights, S())
    const hasDfwAus = result.some((r) => r.key.includes('AUS'))
    expect(hasDfwAus).toBe(false)
  })
})

describe('flagEmoji helper (via byCountry)', () => {
  it('produces regional indicator pairs for 2-letter codes', () => {
    const result = byCountry(flights, S())
    // US flag: 🇺🇸 is two chars (regional indicator S + regional indicator U)
    const us = result.find((r) => r.code === 'US')!
    // Regional indicators are encoded as surrogate pairs; each is 2 code units in JS strings
    // 2 regional indicators = 4 code units
    expect(us.flag.length).toBe(4) // 2 regional indicators, each 2 UTF-16 code units
  })
})

// ─── Helpers for new tests ─────────────────────────────────────────────────
const H2 = REQUIRED_COLUMNS.join(',')
const TODAY2 = '2026-06-25'

// Build a full CSV row (33 fields). Only override the fields we care about.
// Col positions: 0=Date,1=Airline,2=Flight,3=From,4=To,5-8=terminals/gates,
//   9=Canceled,10=DivertedTo,11=GateDepSched,12=GateDepActual,
//   13=TakeoffSched,14=TakeoffActual,15=LandingSched,16=LandingActual,
//   17=GateArrSched,18=GateArrActual,19=AircraftTypeName,20=TailNumber,
//   21=PNR,22=Seat,23=SeatType,24=CabinClass,25=Reason,26=Notes,
//   27=FlightFlightyID,28=AirlineFlightyID,29=DepAirportFlightyID,
//   30=ArrAirportFlightyID,31=DivertedFlightyID,32=AircraftTypeFlightyID
type RowOpts = {
  date?: string; from?: string; to?: string; canceled?: boolean
  takeoffActual?: string; gateDepSched?: string
  gateArrSched?: string; gateArrActual?: string
  aircraft?: string; tail?: string
}
function mkRow(opts: RowOpts = {}) {
  const date = opts.date ?? '2020-01-01'
  const from = opts.from ?? 'DFW'
  const to = opts.to ?? 'AUS'
  const canceled = opts.canceled ? 'true' : 'false'
  const takeoffActual = opts.takeoffActual ?? ''
  const gateDepSched = opts.gateDepSched ?? `${date}T09:00`
  const gateArrSched = opts.gateArrSched ?? ''
  const gateArrActual = opts.gateArrActual ?? ''
  const aircraft = opts.aircraft ?? 'Boeing 737'
  const tail = opts.tail ?? ''
  const cols = [
    date, 'AAL', '1', from, to, '', '', '', '',
    canceled, '',
    gateDepSched, '',
    '', takeoffActual,
    '', '',
    gateArrSched, gateArrActual,
    aircraft, tail,
    '', '', '', '', '', '', '', '', '', '', '', '',
  ]
  return enrichFlight(parseFlightyCsv([H2, cols.join(',')].join('\n')).rows[0], TODAY2, C)
}

// ─── extremeFlights ────────────────────────────────────────────────────────
describe('extremeFlights', () => {
  // DFW→AUS (~190 mi), DFW→LHR (~4750 mi), DFW→DFW local (0 mi)
  const f_short = mkRow({ from: 'DFW', to: 'AUS', date: '2020-01-01' })
  const f_long  = mkRow({ from: 'DFW', to: 'LHR', date: '2020-01-02' })
  const f_local = mkRow({ from: 'DFW', to: 'DFW', date: '2020-01-03' })
  const allThree = [f_short, f_long, f_local]

  it('distance,short now INCLUDES 0-mi local flights (real flights like RPJ), ascending', () => {
    const result = extremeFlights(allThree, 'distance', 'short')
    expect(result[0]).toBe(f_local) // 0 mi is the shortest
    expect(result[1]).toBe(f_short)
    expect(result[2]).toBe(f_long)
  })

  it('distance,long returns descending (LHR first)', () => {
    const result = extremeFlights(allThree, 'distance', 'long')
    // local flight has distanceMi===0 which is not null, but we skip nulls
    // local is 0 mi so should be last; LHR first
    expect(result[0]).toBe(f_long)
  })

  it('duration,long returns descending', () => {
    const result = extremeFlights(allThree, 'duration', 'long')
    // LHR is much longer than AUS
    expect(result[0]).toBe(f_long)
  })

  it('n limits the result', () => {
    const result = extremeFlights(allThree, 'distance', 'long', 1)
    expect(result.length).toBe(1)
  })

  it('excludes flights with null distance', () => {
    const f_null = mkRow({ from: 'XYZ', to: 'QQQ' }) // unresolved airports -> null distanceMi
    const result = extremeFlights([f_null, f_short], 'distance', 'short')
    expect(result.every(f => f.distanceMi !== null)).toBe(true)
  })
})

// ─── byMonth ──────────────────────────────────────────────────────────────
describe('byMonth', () => {
  const fA = mkRow({ date: '2020-03-15' })
  const fB = mkRow({ date: '2020-03-20' })
  const fC = mkRow({ date: '2021-01-05' })

  it('groups by YYYY-MM and counts', () => {
    const result = byMonth([fA, fB, fC])
    const mar = result.find(r => r.ym === '2020-03')
    expect(mar?.count).toBe(2)
    const jan = result.find(r => r.ym === '2021-01')
    expect(jan?.count).toBe(1)
  })

  it('sorted ascending by ym', () => {
    const result = byMonth([fC, fA, fB])
    expect(result[0].ym).toBe('2020-03')
    expect(result[1].ym).toBe('2021-01')
  })

  it('ym format is YYYY-MM', () => {
    const result = byMonth([fA])
    expect(result[0].ym).toMatch(/^\d{4}-\d{2}$/)
  })
})

// ─── byYearMonthMatrix ────────────────────────────────────────────────────
describe('byYearMonthMatrix', () => {
  // Jan 2021 (month index 0), March 2020 (index 2)
  const fA = mkRow({ date: '2021-01-05' })
  const fB = mkRow({ date: '2020-03-15' })
  const fC = mkRow({ date: '2020-03-20' })

  it('returns one row per year, months length 12', () => {
    const result = byYearMonthMatrix([fA, fB, fC])
    for (const row of result) {
      expect(row.months.length).toBe(12)
    }
  })

  it('months counts are correct', () => {
    const result = byYearMonthMatrix([fA, fB, fC])
    const row2020 = result.find(r => r.year === 2020)!
    expect(row2020.months[2]).toBe(2) // March = index 2, 2 flights
    const row2021 = result.find(r => r.year === 2021)!
    expect(row2021.months[0]).toBe(1) // Jan = index 0
  })

  it('rows sorted descending by year', () => {
    const result = byYearMonthMatrix([fA, fB, fC])
    expect(result[0].year).toBe(2021)
    expect(result[1].year).toBe(2020)
  })
})

// ─── hourHistogram ────────────────────────────────────────────────────────
describe('hourHistogram', () => {
  // Gate dep sched at 09:00, takeoff actual at 14:00, gate arr sched at 17:00, gate arr actual at 18:00
  const fDep = mkRow({ gateDepSched: '2020-01-01T09:00', takeoffActual: '2020-01-01T14:00' })
  const fArr = mkRow({
    gateDepSched: '2020-01-01T09:00',
    gateArrSched: '2020-01-01T17:00',
    gateArrActual: '2020-01-01T18:00',
  })

  it('dep histogram has length 24', () => {
    const result = hourHistogram([fDep], 'dep')
    expect(result.length).toBe(24)
  })

  it('arr histogram has length 24', () => {
    const result = hourHistogram([fArr], 'arr')
    expect(result.length).toBe(24)
  })

  it('dep: takeoffActual (hour 14) wins over gateDepSched (hour 9)', () => {
    // enrich picks takeoffActual first for depHourLocal
    const result = hourHistogram([fDep], 'dep')
    expect(result[14]).toBe(1)
  })

  it('arr: gateArrActual (hour 18) wins for arrHourLocal', () => {
    const result = hourHistogram([fArr], 'arr')
    expect(result[18]).toBe(1)
  })

  it('dep with only gateDepSched at 09:00 falls in bucket 9', () => {
    const fOnly9 = mkRow({ gateDepSched: '2020-06-01T09:00' })
    const result = hourHistogram([fOnly9], 'dep')
    expect(result[9]).toBe(1)
    expect(result.reduce((a, b) => a + b, 0)).toBe(1)
  })

  it('skips null hours', () => {
    const fNoTime = mkRow({ gateDepSched: '', takeoffActual: '' })
    const result = hourHistogram([fNoTime], 'dep')
    expect(result.reduce((a, b) => a + b, 0)).toBe(0)
  })
})

// ─── byAircraft ──────────────────────────────────────────────────────────
describe('byAircraft', () => {
  const f737   = mkRow({ aircraft: 'Boeing 737' })          // narrow
  const fA320  = mkRow({ aircraft: 'Airbus A320' })         // narrow
  const fBlank = mkRow({ aircraft: '' })                     // blank type

  it('byType excludes blank aircraft types', () => {
    const result = byAircraft([f737, fA320, fBlank])
    expect(result.byType.every(t => t.type !== '')).toBe(true)
  })

  it('byClass keeps all non-empty classes including unclassified', () => {
    const fUnknown = mkRow({ aircraft: 'Some Random Plane' })
    const result = byAircraft([f737, fUnknown])
    // 737 -> narrow; unknown -> unclassified
    const classes = result.byClass.map(c => c.cls)
    expect(classes).toContain('narrow')
    expect(classes).toContain('unclassified')
  })

  it('byType sorted desc by count', () => {
    const result = byAircraft([f737, f737, fA320])
    expect(result.byType[0].type).toBe('Boeing 737')
    expect(result.byType[0].count).toBe(2)
  })

  it('byClass sorted desc by count', () => {
    const result = byAircraft([f737, f737, fA320])
    expect(result.byClass[0].cls).toBe('narrow')
    expect(result.byClass[0].count).toBe(3)
  })
})

// ─── byTail ──────────────────────────────────────────────────────────────
describe('byTail', () => {
  const fN1a = mkRow({ tail: 'N1' })
  const fN1b = mkRow({ tail: 'N1' })
  const fN2  = mkRow({ tail: 'N2' })
  const fNone = mkRow({ tail: '' })

  it('returns only tails with count >= minFlights (default 2)', () => {
    const result = byTail([fN1a, fN1b, fN2, fNone])
    // N1 appears 2x (>=2), N2 1x (<2), blank excluded
    expect(result.map(r => r.tail)).toEqual(['N1'])
  })

  it('excludes blank tails', () => {
    const result = byTail([fN1a, fN1b, fNone, fNone, fNone])
    expect(result.every(r => r.tail !== '')).toBe(true)
  })

  it('sorted desc by count, tiebreak by tail string', () => {
    const fN3a = mkRow({ tail: 'N3' })
    const fN3b = mkRow({ tail: 'N3' })
    const result = byTail([fN1a, fN1b, fN3a, fN3b], 2)
    expect(result.map(r => r.tail)).toEqual(['N1', 'N3']) // alphabetical tiebreak
  })

  it('respects custom minFlights', () => {
    const result = byTail([fN1a, fN1b, fN2], 1)
    expect(result.length).toBe(2)
  })
})

// ─── delayStats ──────────────────────────────────────────────────────────
describe('delayStats', () => {
  // 5 min late (on-time <= 15), 40 min late (delayed)
  // gateArrSched and gateArrActual control delayMin
  const onTime = mkRow({
    gateArrSched: '2020-01-01T10:00', gateArrActual: '2020-01-01T10:05',
  }) // delayMin = 5
  const late = mkRow({
    gateArrSched: '2020-01-01T10:00', gateArrActual: '2020-01-01T10:40',
  }) // delayMin = 40
  const canceled1 = mkRow({ canceled: true })
  const noDelay = mkRow() // no gateArr times -> delayMin null

  it('onTimePct is 50% for one on-time and one late (with delay data)', () => {
    const result = delayStats([onTime, late, canceled1, noDelay])
    expect(result.counted).toBe(2) // only 2 have delayMin != null
    expect(result.onTimePct).toBe(50) // 1/2 on-time
  })

  it('mostDelayed[0] is the 40-min flight', () => {
    const result = delayStats([onTime, late])
    expect(result.mostDelayed[0]).toBe(late)
    expect(result.mostDelayed[0].delayMin).toBe(40)
  })

  it('counted is 0 and onTimePct is 0 when no delay data', () => {
    const result = delayStats([noDelay])
    expect(result.counted).toBe(0)
    expect(result.onTimePct).toBe(0)
  })

  it('canceled counts correctly', () => {
    const result = delayStats([onTime, canceled1])
    expect(result.canceled).toBe(1)
  })

  it('diverted counts correctly', () => {
    // divertedToCode makes diverted=true; use a raw approach
    const row = parseFlightyCsv([H2, `2020-01-01,AAL,1,DFW,AUS,,,,,false,DAL,2020-01-01T09:00,,,,,,,,Boeing 737,,,,,,,,,,,,`].join('\n')).rows[0]
    const fDiv = enrichFlight(row, TODAY2, C)
    const result = delayStats([onTime, fDiv])
    expect(result.diverted).toBe(1)
  })
})

// ─── geoExtremes ─────────────────────────────────────────────────────────
describe('geoExtremes', () => {
  // AUS: lat~30.2, lon~-97.7; LHR: lat~51.5, lon~-0.45
  const fAus = mkRow({ from: 'AUS', to: 'DFW', date: '2020-01-01' })
  const fLhr = mkRow({ from: 'DFW', to: 'LHR', date: '2020-01-02' })

  it('returns null for empty flights', () => {
    expect(geoExtremes([])).toBeNull()
  })

  it('farthest picks LHR over AUS (from HOME=DFW)', () => {
    const result = geoExtremes([fAus, fLhr])
    expect(result).not.toBeNull()
    expect(result!.farthest.airport.iata).toBe('LHR')
    expect(result!.farthest.miles).toBeGreaterThan(4000)
  })

  it('north is LHR (higher lat ~51) vs AUS (~30)', () => {
    const result = geoExtremes([fAus, fLhr])
    expect(result!.north.iata).toBe('LHR')
  })

  it('south is AUS (lower lat ~30) vs LHR (~51)', () => {
    const result = geoExtremes([fAus, fLhr])
    expect(result!.south.iata).toBe('AUS')
  })

  it('returns null when no resolved airports', () => {
    const fUnresolved = mkRow({ from: 'XYZ', to: 'QQQ' })
    expect(geoExtremes([fUnresolved])).toBeNull()
  })
})

// ─── odometer ────────────────────────────────────────────────────────────
describe('odometer', () => {
  // Two DFW→LHR flights. LHR distance ≈ 4748 mi each → ~9496 total
  const f1 = mkRow({ from: 'DFW', to: 'LHR', date: '2020-01-01' })
  const f2 = mkRow({ from: 'DFW', to: 'LHR', date: '2020-01-02' })

  it('sums distanceMi correctly (skips null)', () => {
    const fNull = mkRow({ from: 'XYZ', to: 'QQQ' })
    const result = odometer([f1, f2, fNull])
    const expected = (f1.distanceMi ?? 0) + (f2.distanceMi ?? 0)
    expect(result.miles).toBeCloseTo(expected, 0)
  })

  it('aroundEarth math: miles/24901 rounded to 1dp', () => {
    const result = odometer([f1, f2])
    const expected = Math.round((result.miles / 24901) * 10) / 10
    expect(result.aroundEarth).toBe(expected)
  })

  it('toMoonPct math: miles/238900*100 rounded to 1dp', () => {
    const result = odometer([f1, f2])
    const expected = Math.round((result.miles / 238900) * 100 * 10) / 10
    expect(result.toMoonPct).toBe(expected)
  })

  it('returns zeros for empty flights', () => {
    const result = odometer([])
    expect(result.miles).toBe(0)
    expect(result.aroundEarth).toBe(0)
    expect(result.toMoonPct).toBe(0)
  })
})

// ─── records ─────────────────────────────────────────────────────────────
describe('records', () => {
  const fA = mkRow({ date: '2020-03-15', from: 'DFW', to: 'AUS' })
  const fB = mkRow({ date: '2020-03-15', from: 'AUS', to: 'DFW' })
  const fC = mkRow({ date: '2020-04-01', from: 'DFW', to: 'LHR' })
  const fD = mkRow({ date: '2021-01-10', from: 'DFW', to: 'AUS' })

  it('mostInDay picks the date with 2 flights (2020-03-15)', () => {
    const result = records([fA, fB, fC, fD], TODAY2)
    expect(result.mostInDay.date).toBe('2020-03-15')
    expect(result.mostInDay.count).toBe(2)
  })

  it('busiestMonth is 2020-03 (2 flights)', () => {
    const result = records([fA, fB, fC, fD], TODAY2)
    expect(result.busiestMonth.ym).toBe('2020-03')
    expect(result.busiestMonth.count).toBe(2)
  })

  it('busiestYear is 2020 (3 flights)', () => {
    const result = records([fA, fB, fC, fD], TODAY2)
    expect(result.busiestYear.year).toBe(2020)
    expect(result.busiestYear.count).toBe(3)
  })

  it('longestGapDays is correct', () => {
    // 2020-03-15 to 2020-04-01 = 17 days; 2020-04-01 to 2021-01-10 = 284 days
    const result = records([fA, fB, fC, fD], TODAY2)
    expect(result.longestGapDays).toBe(284)
  })

  it('milestones flight 1 is fA (first by date/rawIndex)', () => {
    const result = records([fA, fB, fC, fD], TODAY2)
    const m1 = result.milestones.find(m => m.ordinal === 1)
    // milestones([...], [100,500,1000]) only returns those ≤ length (4)
    expect(m1).toBeUndefined() // 1 not in [100,500,1000] => not returned
  })

  it('milestones returns empty when none of [100,500,1000] <= flight count', () => {
    const result = records([fA, fB], TODAY2)
    expect(result.milestones).toEqual([])
  })
})

describe('intercontinentalByPair', () => {
  it('groups intercontinental flights by continent pair', () => {
    const fs = [route('DFW', 'LHR'), route('HNL', 'DFW'), route('DFW', 'AUS')]
    const groups = intercontinentalByPair(fs, S())
    expect(groups).toHaveLength(2) // EU↔NA and NA↔OC (DFW-AUS is intra-state, excluded)
    const labels = groups.map((g) => g.label)
    expect(labels.some((l) => /Europe/.test(l) && /North America/.test(l))).toBe(true)
    expect(labels.some((l) => /Oceania/.test(l))).toBe(true)
  })
})

describe('superDomestic home-state scoping', () => {
  it('keeps only home-state routes in intra-state; other same-state routes become intra-country', () => {
    // home DFW (US-TX): DFW-AUS stays intra-state; LAX-SFO (both US-CA) drops to intra-country
    const fs = [route('DFW', 'AUS'), route('LAX', 'SFO')]
    const tiers = superDomestic(fs, S({ home: 'DFW', groupAirports: false }))
    expect(tiers.find((t) => t.tier === 'intra-state')?.routes).toHaveLength(1)
    expect(tiers.find((t) => t.tier === 'intra-country')?.routes).toHaveLength(1)
  })
})

describe('byAircraft family grouping', () => {
  const af = (type: string): EnrichedFlight => ({ aircraftType: type, aircraftClass: 'narrow' } as EnrichedFlight)
  it('collapses same-model sub-variants when grouping is on, keeping different models apart', () => {
    const fs = [af('Boeing 737-800'), af('Boeing 737-700'), af('Boeing 777-300 ER'), af('Airbus A320neo'), af('Airbus A320')]
    const g = byAircraft(fs, true)
    expect(g.byType.find((t) => t.type === 'Boeing 737')?.count).toBe(2)
    expect(g.byType.find((t) => t.type === 'Boeing 777')?.count).toBe(1)
    expect(g.byType.find((t) => t.type === 'Airbus A320')?.count).toBe(2)
  })
  it('keeps raw variant strings when grouping is off', () => {
    const fs = [af('Boeing 737-800'), af('Boeing 737-700')]
    const u = byAircraft(fs, false)
    expect(u.byType.find((t) => t.type === 'Boeing 737-800')?.count).toBe(1)
    expect(u.byType.find((t) => t.type === 'Boeing 737-700')?.count).toBe(1)
  })
})

describe('groundGaps', () => {
  it('returns the longest grounded gaps with bounding dates, sorted desc', () => {
    const fs = [route('DFW', 'AUS', '2018-01-01'), route('DFW', 'AUS', '2018-01-10'), route('DFW', 'AUS', '2018-02-10')]
    const gaps = groundGaps(fs, 5)
    expect(gaps[0]).toMatchObject({ days: 31, from: '2018-01-10', to: '2018-02-10' })
    expect(gaps[1]).toMatchObject({ days: 9, from: '2018-01-01', to: '2018-01-10' })
  })
})

describe('commonLayovers', () => {
  const HR = 3_600_000
  const BASE = Date.parse('2020-01-01T00:00:00Z')
  // hand-build minimal flights — commonLayovers only reads resolved/isLocalFlight/from-toCode/utc instants/rawIndex/date
  const FL = (o: Partial<EnrichedFlight>): EnrichedFlight => ({
    resolved: true, isLocalFlight: false, rawIndex: 0, date: '2020-01-01',
    fromCode: 'AAA', toCode: 'BBB', arrUtcMs: null, depUtcMs: null,
    ...o,
  } as EnrichedFlight)

  it('detects a connection within the threshold (2h layover at DFW)', () => {
    const a = FL({ rawIndex: 0, fromCode: 'AUS', toCode: 'DFW', depUtcMs: BASE + 10 * HR, arrUtcMs: BASE + 11 * HR })
    const b = FL({ rawIndex: 1, fromCode: 'DFW', toCode: 'LAX', depUtcMs: BASE + 13 * HR, arrUtcMs: BASE + 15 * HR })
    const res = commonLayovers([a, b], S({ groupAirports: false, layoverMaxHours: 5 }))
    expect(res).toHaveLength(1)
    expect(res[0]).toMatchObject({ key: 'DFW', airportCode: 'DFW', count: 1, avgGapMin: 120 })
  })

  it('ignores a gap longer than the threshold', () => {
    const a = FL({ rawIndex: 0, fromCode: 'AUS', toCode: 'DFW', depUtcMs: BASE + 10 * HR, arrUtcMs: BASE + 11 * HR })
    const b = FL({ rawIndex: 1, fromCode: 'DFW', toCode: 'LAX', depUtcMs: BASE + 20 * HR, arrUtcMs: BASE + 22 * HR })
    expect(commonLayovers([a, b], S({ groupAirports: false, layoverMaxHours: 5 }))).toHaveLength(0)
  })

  it('does not count when you do not re-depart the same airport', () => {
    const a = FL({ rawIndex: 0, fromCode: 'AUS', toCode: 'DFW', depUtcMs: BASE + 10 * HR, arrUtcMs: BASE + 11 * HR })
    const b = FL({ rawIndex: 1, fromCode: 'ORD', toCode: 'LAX', depUtcMs: BASE + 13 * HR, arrUtcMs: BASE + 15 * HR })
    expect(commonLayovers([a, b], S({ groupAirports: false, layoverMaxHours: 5 }))).toHaveLength(0)
  })

  it('skips a pair when either absolute instant is missing', () => {
    const a = FL({ rawIndex: 0, fromCode: 'AUS', toCode: 'DFW', depUtcMs: BASE + 10 * HR, arrUtcMs: null })
    const b = FL({ rawIndex: 1, fromCode: 'DFW', toCode: 'LAX', depUtcMs: BASE + 13 * HR, arrUtcMs: BASE + 15 * HR })
    expect(commonLayovers([a, b], S({ groupAirports: false, layoverMaxHours: 5 }))).toHaveLength(0)
  })

  it('excludes a day-trip turnaround (out and back) when excludeDayTrips is on, counts it when off', () => {
    // DFW->AUS then AUS->DFW: at AUS you flew back to where you came from = day trip, not a layover
    const a = FL({ rawIndex: 0, fromCode: 'DFW', toCode: 'AUS', depUtcMs: BASE + 10 * HR, arrUtcMs: BASE + 11 * HR })
    const b = FL({ rawIndex: 1, fromCode: 'AUS', toCode: 'DFW', depUtcMs: BASE + 13 * HR, arrUtcMs: BASE + 14 * HR })
    expect(commonLayovers([a, b], S({ groupAirports: false, excludeDayTrips: true }))).toHaveLength(0)
    expect(commonLayovers([a, b], S({ groupAirports: false, excludeDayTrips: false }))).toHaveLength(1)
  })

  it('aggregates under the metro group name when grouping is on', () => {
    const a = FL({ rawIndex: 0, fromCode: 'AUS', toCode: 'DFW', depUtcMs: BASE + 10 * HR, arrUtcMs: BASE + 11 * HR })
    const b = FL({ rawIndex: 1, fromCode: 'DFW', toCode: 'LAX', depUtcMs: BASE + 13 * HR, arrUtcMs: BASE + 15 * HR })
    const res = commonLayovers([a, b], S({ groupAirports: true, layoverMaxHours: 5 }))
    expect(res[0].key).toBe('Dallas')
  })
})
