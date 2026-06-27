import { describe, it, expect, beforeEach } from 'vitest'
import { saveCsv, loadCsv, clearCsv, CSV_KEY } from '../../app/state/csv-store'

function mem(): Storage {
  const m = new Map<string, string>()
  return {
    get length() { return m.size },
    clear: () => m.clear(),
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, v),
  }
}

describe('csv-store', () => {
  let s: Storage
  beforeEach(() => { s = mem() })

  it('returns null when nothing saved', () => {
    expect(loadCsv(s)).toBeNull()
  })

  it('round-trips a saved CSV', () => {
    saveCsv('trips.csv', 'a,b\n1,2', s)
    expect(loadCsv(s)).toEqual({ name: 'trips.csv', text: 'a,b\n1,2' })
  })

  it('clear removes the saved CSV', () => {
    saveCsv('trips.csv', 'x', s)
    clearCsv(s)
    expect(loadCsv(s)).toBeNull()
    expect(s.getItem(CSV_KEY)).toBeNull()
  })

  it('ignores a malformed blob', () => {
    s.setItem(CSV_KEY, 'not json{')
    expect(loadCsv(s)).toBeNull()
  })
})
