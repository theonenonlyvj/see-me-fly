import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import Papa from 'papaparse'

const URL = 'https://raw.githubusercontent.com/jpatokal/openflights/master/data/airlines.dat'
const here = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(here, '../../src/reference/airlines.json')

// airlines.dat columns: id, name, alias, iata, icao, callsign, country, active
async function main() {
  const res = await fetch(URL)
  const text = await res.text()
  const rows = Papa.parse<string[]>(text, { worker: false }).data
  type Cand = { id: number; name: string; active: boolean }
  const byIcao = new Map<string, Cand[]>()
  for (const row of rows) {
    if (!row || row.length < 8) continue
    const id = Number(row[0])
    const name = (row[1] || '').replace(/^"|"$/g, '').trim()
    const icao = (row[4] || '').replace(/^"|"$/g, '').trim()
    const active = (row[7] || '').replace(/^"|"$/g, '').trim() === 'Y'
    if (!icao || icao === '\\N' || icao.length !== 3) continue
    if (!name || name === '\\N' || /^unknown$/i.test(name)) continue
    const list = byIcao.get(icao) ?? []
    list.push({ id, name, active })
    byIcao.set(icao, list)
  }
  const out: Record<string, string> = {}
  let collisions = 0
  for (const [icao, cands] of byIcao) {
    if (cands.length > 1) collisions++
    // Prefer active=Y, then a name without "Domestic", then lowest id.
    cands.sort((a, b) =>
      Number(b.active) - Number(a.active) ||
      Number(/domestic/i.test(a.name)) - Number(/domestic/i.test(b.name)) ||
      a.id - b.id
    )
    out[icao] = cands[0].name
  }
  writeFileSync(OUT, JSON.stringify(out))
  console.log(`airlines.json: ${Object.keys(out).length} ICAO codes, ${collisions} collisions resolved`)
}
main().catch((e) => { console.error(e); process.exit(1) })
