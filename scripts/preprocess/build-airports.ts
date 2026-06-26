import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import tzlookup from 'tz-lookup'
import { fetchCsv } from './lib/fetch-csv'

const OURAIRPORTS = 'https://davidmegginson.github.io/ourairports-data/airports.csv'
const KEEP_TYPES = new Set(['large_airport', 'medium_airport', 'small_airport'])

const here = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(here, '../../src/reference/airports.json')

function num(s: string): number | null {
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

async function main() {
  const rows = await fetchCsv(OURAIRPORTS)
  const out: unknown[] = []
  let skipped = 0
  for (const r of rows) {
    const iata = (r.iata_code || '').trim()
    const localCode = (r.local_code || '').trim()
    const type = (r.type || '').trim()
    // Keep: anything with an IATA code, OR a real airport type carrying an FAA local_code.
    if (!iata && !(KEEP_TYPES.has(type) && localCode)) { skipped++; continue }
    const lat = num(r.latitude_deg)
    const lon = num(r.longitude_deg)
    if (lat === null || lon === null) { skipped++; continue }
    let tz = ''
    try { tz = tzlookup(lat, lon) } catch { tz = '' }
    out.push({
      iata: iata || null,
      localCode: localCode || null,
      ident: (r.ident || '').trim(),
      name: (r.name || '').trim(),
      municipality: (r.municipality || '').trim(),
      lat, lon,
      country: (r.iso_country || '').trim(),
      region: (r.iso_region || '').trim(),
      continent: (r.continent || '').trim(),
      tz, // '' = tz unresolved -> engine falls back to the distance-based duration estimate (spec §4.2)
    })
  }
  writeFileSync(OUT, JSON.stringify(out))
  console.log(`airports.json: ${out.length} kept, ${skipped} skipped`)
}
main().catch((e) => { console.error(e); process.exit(1) })
