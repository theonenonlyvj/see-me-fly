import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { fetchCsv } from './lib/fetch-csv'

const REGIONS = 'https://davidmegginson.github.io/ourairports-data/regions.csv'
const COUNTRIES = 'https://davidmegginson.github.io/ourairports-data/countries.csv'
const here = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(here, '../../src/reference/regions.json')

async function main() {
  const regionRows = await fetchCsv(REGIONS)   // columns: id, code, local_code, name, continent, iso_country, ...
  const countryRows = await fetchCsv(COUNTRIES) // columns: id, code, name, continent, ...
  const regions: Record<string, string> = {}
  for (const r of regionRows) {
    const code = (r.code || '').trim()
    const name = (r.name || '').trim()
    if (code && name) regions[code] = name
  }
  // Mexico City: deprecated MX-DIF and current MX-CMX should point to the same name.
  // Handle both directions for forward/backward compatibility.
  if (regions['MX-CMX'] && regions['MX-DIF']) {
    // Both exist: ensure they're equal
    regions['MX-DIF'] = regions['MX-CMX']
  } else if (regions['MX-CMX']) {
    // Only CMX exists: create DIF alias
    regions['MX-DIF'] = regions['MX-CMX']
  } else if (regions['MX-DIF']) {
    // Only DIF exists: create CMX alias to the DIF name
    regions['MX-CMX'] = regions['MX-DIF']
  }
  const countries: Record<string, string> = {}
  for (const c of countryRows) {
    const code = (c.code || '').trim()
    const name = (c.name || '').trim()
    if (code && name) countries[code] = name
  }
  writeFileSync(OUT, JSON.stringify({ regions, countries }))
  console.log(`regions.json: ${Object.keys(regions).length} regions, ${Object.keys(countries).length} countries`)
}
main().catch((e) => { console.error(e); process.exit(1) })
