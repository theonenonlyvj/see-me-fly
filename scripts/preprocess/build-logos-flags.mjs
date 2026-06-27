// Build-time fetch of subdivision flags (US/IN/MX states) + airline logos, inlined as data-URIs
// so the app stays 100% offline at runtime. Run: node scripts/preprocess/build-logos-flags.mjs
//
// Flags: resolved per ISO 3166-2 code via (1) a small override map, (2) Wikidata P41 (flag image),
// (3) Commons "Flag of <name>.svg" by region name (+ ASCII-folded + ", India" variants).
// Each is fetched as a server-side-rasterized PNG (Wikimedia ?width=) so even ornate coat-of-arms
// flags stay a couple KB — complete coverage without blowing the bundle budget.
import { readFileSync, writeFileSync } from 'node:fs'

const UA = { 'User-Agent': 'flight-visualizer-build/1.0 (offline flag/logo bundling; theonenonlyvj@gmail.com)' }
const regions = JSON.parse(readFileSync('src/reference/regions.json', 'utf8')).regions
const SUB = /^(US|IN|MX)-/
const subCodes = Object.keys(regions).filter((k) => SUB.test(k) && !k.endsWith('-U-A'))

// Codes whose region name doesn't map cleanly to a Commons filename:
// deprecated/duplicate codes, ASCII spellings, or renamed subdivisions.
const OVERRIDE = {
  'IN-PY': 'Flag of Puducherry, India.svg',
  'MX-DIF': 'Flag of Mexico City.svg', // legacy Distrito Federal code → Mexico City
  'MX-MEX': 'Flag of the State of Mexico.svg',
  'MX-MIC': 'Flag of Michoacan.svg',
  'MX-NLE': 'Flag of Nuevo Leon.svg',
  'MX-SLP': 'Flag of San Luis Potosi.svg',
}

const FLAG_PX = 48 // displayed ~16px; 48 is crisp at 3x yet tiny as PNG
const stripDiacritics = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
const filePath = (name) => 'https://commons.wikimedia.org/wiki/Special:FilePath/' + encodeURIComponent(name)

// Wikidata: ISO 3166-2 code (P300) → flag image (P41), authoritative where populated.
async function wikidataFlags() {
  const q = `SELECT ?code ?flag WHERE { ?item wdt:P300 ?code . ?item wdt:P41 ?flag . FILTER(STRSTARTS(?code,"US-")||STRSTARTS(?code,"IN-")||STRSTARTS(?code,"MX-")) }`
  try {
    const r = await fetch('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(q), { headers: { ...UA, Accept: 'application/sparql-results+json' } })
    const j = await r.json()
    const m = {}
    for (const b of j.results.bindings) if (!m[b.code.value]) m[b.code.value] = b.flag.value // first-wins
    return m
  } catch { return {} }
}

const sleep = (ms) => new Promise((res) => setTimeout(res, ms))

// Fetch a Commons file rasterized to a small PNG (server-side via ?width=). data-URI or null.
// Wikimedia rate-limits on-the-fly thumbnail rendering hard, so throttle every request (~300ms
// gap) and back off exponentially on 429/5xx — back-to-back requests get 429-stormed.
async function fetchPng(urlNoWidth) {
  const url = urlNoWidth + (urlNoWidth.includes('?') ? '&' : '?') + 'width=' + FLAG_PX
  for (let attempt = 0; attempt < 4; attempt++) {
    await sleep(attempt === 0 ? 300 : 1000 * attempt) // 300ms base gap, then 1s/2s/3s backoff
    try {
      const r = await fetch(url, { headers: UA })
      if (r.status === 404) return null
      if (r.status === 429 || r.status >= 500) continue // throttled/transient → back off & retry
      if (r.ok && (r.headers.get('content-type') || '').includes('image')) {
        const buf = Buffer.from(await r.arrayBuffer())
        if (buf.length > 200) return 'data:image/png;base64,' + buf.toString('base64')
      }
      return null // other non-retryable response
    } catch { /* network hiccup → retry */ }
  }
  return null
}

const p41 = await wikidataFlags()
const regionFlags = {}
for (const code of subCodes) {
  const name = regions[code]
  const candidates = []
  if (OVERRIDE[code]) candidates.push(filePath(OVERRIDE[code]))
  if (p41[code]) candidates.push(p41[code])
  candidates.push(filePath(`Flag of ${name}.svg`))
  if (stripDiacritics(name) !== name) candidates.push(filePath(`Flag of ${stripDiacritics(name)}.svg`))
  if (code.startsWith('IN-')) {
    candidates.push(filePath(`Flag of ${name}, India.svg`))
    candidates.push(filePath(`Flag of ${stripDiacritics(name)}, India.svg`))
  }
  for (const c of candidates) {
    const uri = await fetchPng(c)
    if (uri) { regionFlags[code] = uri; break }
  }
}
writeFileSync('src/reference/region-flags.json', JSON.stringify(regionFlags) + '\n')
const cnt = (p) => subCodes.filter((c) => c.startsWith(p) && regionFlags[c]).length
const tot = (p) => subCodes.filter((c) => c.startsWith(p)).length
console.log(`region flags: US ${cnt('US-')}/${tot('US-')}, IN ${cnt('IN-')}/${tot('IN-')}, MX ${cnt('MX-')}/${tot('MX-')}`)

// curated major carriers as [ICAO, IATA] — covers most travel; monogram fallback handles the rest
const AIRLINES = [
  ['AAL', 'AA'], ['UAL', 'UA'], ['DAL', 'DL'], ['SWA', 'WN'], ['ASA', 'AS'], ['JBU', 'B6'], ['FFT', 'F9'], ['NKS', 'NK'], ['HAL', 'HA'], ['SCX', 'SY'],
  ['BAW', 'BA'], ['VIR', 'VS'], ['DLH', 'LH'], ['AFR', 'AF'], ['KLM', 'KL'], ['IBE', 'IB'], ['SWR', 'LX'], ['AUA', 'OS'], ['TAP', 'TP'], ['SAS', 'SK'],
  ['FIN', 'AY'], ['EIN', 'EI'], ['ITY', 'AZ'], ['AEE', 'A3'], ['TVS', 'QS'],
  ['UAE', 'EK'], ['QTR', 'QR'], ['ETD', 'EY'], ['THY', 'TK'], ['SVA', 'SV'], ['ELY', 'LY'],
  ['QFA', 'QF'], ['ANZ', 'NZ'], ['SIA', 'SQ'], ['CPA', 'CX'], ['JAL', 'JL'], ['ANA', 'NH'], ['KAL', 'KE'], ['AAR', 'OZ'], ['THA', 'TG'], ['MAS', 'MH'], ['GIA', 'GA'], ['SIA', 'SQ'],
  ['CCA', 'CA'], ['CES', 'MU'], ['CSN', 'CZ'], ['AIC', 'AI'], ['IGO', '6E'],
  ['ACA', 'AC'], ['WJA', 'WS'], ['AMX', 'AM'], ['VOI', 'Y4'], ['LAN', 'LA'], ['TAM', 'JJ'], ['AVA', 'AV'], ['CMP', 'CM'], ['AZU', 'AD'], ['GLO', 'G3'],
  ['RYR', 'FR'], ['EZY', 'U2'], ['WZZ', 'W6'], ['VLG', 'VY'], ['NAX', 'DY'], ['EWG', 'EW'], ['ROU', 'RV'],
  ['JZA', 'QK'], ['SKW', 'OO'], ['RPA', 'YX'], ['ENY', 'MQ'], ['ASH', 'YV'], ['QXE', 'QX'], ['EDV', '9E'], ['PDT', 'PT'], ['JIA', 'OH'], ['GJS', 'G7'],
  // carriers in Vijay's data + historical/defunct (Kiwi has icons for most of these)
  // active carriers only — defunct airlines (Continental/CO, Kingfisher/IT, AirTran/FL, JetLite/S2,
  // US Airways/US, Jet Airways/9W, Virgin America/VX) have REASSIGNED IATA codes → Kiwi returns the
  // wrong (new code-holder's) logo, so we omit them (clean monogram instead).
  ['BEL', 'SN'], ['AFL', 'SU'], ['ALK', 'UL'], ['UZB', 'HY'], ['EWG', 'EW'], ['LAN', 'LA'], ['BAW', 'BA'],
]
// Kiwi serves SQUARE airline ICONS (not wordmarks) by IATA. 303 = no logo → skip (monogram fallback).
const logos = {}
for (const [icao, iata] of AIRLINES) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(`https://images.kiwi.com/airlines/64/${iata}.png`) // follow redirects (Kiwi 303s to the real icon)
      if (r.ok) {
        const buf = Buffer.from(await r.arrayBuffer())
        if (buf.length > 400) logos[icao] = 'data:image/png;base64,' + buf.toString('base64')
        break
      }
    } catch { /* retry */ }
    await new Promise((res) => setTimeout(res, 150))
  }
}
writeFileSync('src/reference/airline-logos.json', JSON.stringify(logos) + '\n')
console.log(`airline logos: ${Object.keys(logos).length} of ${AIRLINES.length} carriers`)
