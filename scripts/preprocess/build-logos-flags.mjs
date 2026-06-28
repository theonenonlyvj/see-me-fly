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

const FLAG_PX = 40 // displayed as a ~14px chip; 40 stays crisp yet keeps the full set inside the bundle budget
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

// Fetch a Wikimedia file rasterized to a small image (server-side via ?width=). data-URI or null.
// Wikimedia rate-limits on-the-fly thumbnail rendering hard, so throttle every request (~300ms
// gap) and back off exponentially on 429/5xx — back-to-back requests get 429-stormed.
async function fetchImage(urlNoWidth, width) {
  const url = urlNoWidth + (urlNoWidth.includes('?') ? '&' : '?') + 'width=' + width
  for (let attempt = 0; attempt < 4; attempt++) {
    await sleep(attempt === 0 ? 300 : 1000 * attempt) // 300ms base gap, then 1s/2s/3s backoff
    try {
      const r = await fetch(url, { headers: UA })
      if (r.status === 404) return null
      if (r.status === 429 || r.status >= 500) continue // throttled/transient → back off & retry
      const ct = (r.headers.get('content-type') || '').split(';')[0].trim()
      if (r.ok && ct.startsWith('image/')) {
        const buf = Buffer.from(await r.arrayBuffer())
        if (buf.length > 200) return `data:${ct};base64,` + buf.toString('base64')
      }
      return null // other non-retryable response
    } catch { /* network hiccup → retry */ }
  }
  return null
}
const fetchPng = (urlNoWidth) => fetchImage(urlNoWidth, FLAG_PX)

if (!process.env.SKIP_FLAGS) { // SKIP_FLAGS=1 to iterate on logos without re-fetching all flags
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
}

// Real airline brand logos (wordmarks), keyed by ICAO (the code that appears in the flight export).
// Sourced from each carrier's Wikipedia infobox logo via en.wikipedia's FilePath, which serves BOTH
// Commons PD wordmarks (Southwest, AirTran, Delta…) AND local fair-use logos (United, Continental,
// US Airways, Jet Airways, Virgin America…). This REPLACES the old Kiwi-by-IATA source, which served
// Kiwi's own "K" placeholder for carriers it lacked (Southwest!) and the WRONG (reassigned-IATA)
// logo for defunct carriers. Filenames resolved from infoboxes; the export's carriers were
// spot-checked visually. Anything not listed falls back to a clean monogram badge.
const enFilePath = (name) => 'https://en.wikipedia.org/wiki/Special:FilePath/' + encodeURIComponent(name)
const LOGO_PX = 120 // en.wikipedia thumbnails bucket at 120/250px; 120 (displayed ~20px tall) keeps the full set in budget
const AIRLINE_LOGO_FILES = {
  // carriers in the export — each VISUALLY picked (full brand logo: symbol+name, correct era) by a
  // per-airline agent comparing the current logo vs the Wikipedia infobox logo. Text-only brands
  // (easyJet/Spirit/Vueling/JetBlue/Finnair/JetLite) are genuinely wordmark-only; LAN kept (not LATAM).
  AAL: 'American Airlines logo 2013.svg', SWA: 'Southwest Airlines logo 2014.svg', AWE: 'US Airways Logo Star Alliance 2011.svg', // horizontal side-by-side lockup (the plain "US Airways Logo.svg" is stacked/tall)
  UAL: 'United Airlines Logo.svg', DAL: 'Delta logo.svg', BAW: 'British Airways Logo.svg', QTR: 'Qatar Airways Logo.svg',
  JAI: 'Jet Airways Logo.svg', TRS: 'AirTran Airways logo.svg', IBE: 'Iberia (2013).svg', DLH: 'Lufthansa Logo 2018.svg',
  IGO: 'IndiGo Airlines logo.svg', EZY: 'EasyJet logo.svg', ALK: 'SriLankan Airlines Logo.svg', SCX: 'Sun Country Airlines logo.svg',
  NKS: 'Spirit Airlines logo.svg', VRD: 'Virgin America logo.svg', FIN: 'Finnair Logo.svg', MAS: 'Malaysia Airlines Logo.svg',
  JLL: 'Jet Lite logo.svg', CPA: 'Cathay Pacific logo.svg', VLG: 'Logo Vueling.svg', JAL: 'Japan Airlines Logo (2011).svg',
  UZB: 'Uzbekistan Airways logo.svg', COA: 'Continental Airlines Logo.svg', KFR: 'Fly kingfisher logo 2011.png',
  BEL: 'Brussels airlines logo 2021.svg', RYR: 'Ryanair.svg', WZZ: 'Wizz Air logo 2015.svg', JBU: 'JetBlue Airways Logo.svg',
  THY: 'Turkish Airlines logo 2019 compact.svg', AIC: 'Air India 2023.svg', NOZ: 'Norse.svg', AFL: 'Aeroflot Logo en.svg',
  JSX: 'Logo of JSX.svg', AEE: 'Aegean Airlines Logo 2020.svg', EWG: 'Eurowings Logo.svg', LAN: 'LAN Airlines logo.svg',
  AMX: 'Aeroméxico_Logo_2024_-_Navy.svg', ASA: 'Alaska Airlines logo with tagline.svg',
  // other major world carriers (resolved from Wikipedia infoboxes; broad coverage for other users)
  AFR: 'Air France Logo.svg', VIR: 'Virgin Atlantic logo 2018.svg', SWR: 'Swiss International Air Lines Logo 2011.svg',
  AUA: 'Austrian Airlines logo.svg', TAP: 'TAP-Portugal-Logo.svg', SAS: 'Scandinavian Airlines logo.svg', EIN: 'Aer Lingus logo 2019.svg',
  UAE: 'Emirates Logo.svg', ETD: 'Etihad-airways-logo.svg', SVA: 'Logo of Saudia.svg', ELY: 'El Al logo.svg',
  QFA: 'Qantas Airways logo 2016.svg', ANZ: 'Air New Zealand logo.svg', SIA: 'Singapore Airlines Logo 2.svg', KAL: 'Korean Air 2025.svg',
  AAR: 'Asiana Airlines (2024).svg', THA: 'Thai Airways  logo.svg', GIA: 'Garuda Indonesia Logo.svg', CCA: 'Air China logo.svg',
  CES: 'China Eastern Airlines logo.svg', CSN: 'China Southern Airlines logo.svg', ACA: 'Air Canada 2017.svg', WJA: 'WestJetLogo2018.svg',
  AVA: 'Logo Avianca (Colombia) 2023.svg', CMP: 'Copa airlines logo.svg', AZU: 'Logo da Azul Linhas Aéreas Brasileiras.svg',
  NAX: 'Norwegian_Logo_2024.svg', FFT: 'Frontier Airlines logo.svg', HAL: 'Hawaiian Airlines logo 2017.svg', TVS: 'Smartwings_logo.svg',
  KLM: 'KLM logo.svg', ANA: 'All Nippon Airways Logo.svg', VOI: 'Volaris-logo.svg',
  GLO: 'Gol Linhas Aéreas Inteligentes logo (2015, without the slogan).svg',
}
const logos = {}
let pending = Object.entries(AIRLINE_LOGO_FILES)
for (let pass = 0; pass < 4 && pending.length; pass++) {
  if (pass > 0) await sleep(4000) // cool-off, then retry stragglers (en.wikipedia 429s under load)
  const next = []
  for (const [icao, file] of pending) {
    const uri = await fetchImage(enFilePath(file), LOGO_PX)
    if (uri) logos[icao] = uri; else next.push([icao, file])
  }
  pending = next
}
writeFileSync('src/reference/airline-logos.json', JSON.stringify(logos) + '\n')
console.log(`airline logos: ${Object.keys(logos).length} of ${Object.keys(AIRLINE_LOGO_FILES).length} carriers`)
if (pending.length) console.log('  still missing (check filenames):', pending.map(([c]) => c).join(' '))
