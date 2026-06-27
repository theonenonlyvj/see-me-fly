// Build-time fetch of state flags (circle-flags, public domain) + airline logos (avs.io),
// inlined as data-URIs so the app stays 100% offline at runtime. Run: node scripts/preprocess/build-logos-flags.mjs
import { readFileSync, writeFileSync } from 'node:fs'

const regions = JSON.parse(readFileSync('src/reference/regions.json', 'utf8')).regions
const subCodes = Object.keys(regions).filter((k) => /^(US|IN|MX)-/.test(k))

const regionFlags = {}
for (const code of subCodes) {
  const slug = code.toLowerCase() // US-TX -> us-tx
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(`https://cdn.jsdelivr.net/gh/HatScripts/circle-flags/flags/${slug}.svg`)
      if (r.status === 404) break
      if (r.ok) {
        const svg = await r.text()
        if (svg.includes('<svg')) { regionFlags[code] = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64'); break }
      }
    } catch { /* retry */ }
    await new Promise((res) => setTimeout(res, 200))
  }
}
writeFileSync('src/reference/region-flags.json', JSON.stringify(regionFlags) + '\n')
console.log(`region flags: ${Object.keys(regionFlags).length} of ${subCodes.length} subdivisions`)

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
