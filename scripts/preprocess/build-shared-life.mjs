// Builds the ENCRYPTED shared "life view" blob (public/life.enc) so someone with the code can view
// Vijay's flights/homes/links on the public site. The RAW data never enters the repo — this reads it
// locally, SANITIZES it (strips notes/PNR/addresses/prices/booking-refs/era-labels), then AES-GCM
// encrypts it with a code (PBKDF2-derived key). The output is ciphertext, safe to commit + deploy.
//
//   node scripts/preprocess/build-shared-life.mjs <CODE> [flights.csv] [homes.csv] [links.csv]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { webcrypto as wc } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import Papa from 'papaparse'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '../..')

const code = process.argv[2]
if (!code) { console.error('Usage: node build-shared-life.mjs <CODE> [flights.csv] [homes.csv] [links.csv]'); process.exit(1) }

const FLIGHTS = process.argv[3] || '/Users/vijayram/Cursor/lifecoach/ops/travel/reference/FlightyExport-2026-06-29.csv'
const HOMES = process.argv[4] || '/Users/vijayram/Cursor/lifecoach/ops/travel/see-me-fly_homes.csv'
const LINKS = process.argv[5] || '/Users/vijayram/Cursor/lifecoach/ops/travel/see-me-fly_links.csv'

// Columns to DROP from each file (the "recommended scrub").
const FLIGHT_DROP = new Set(['Dep Terminal', 'Dep Gate', 'Arr Terminal', 'Arr Gate', 'PNR', 'Seat', 'Flight Reason', 'Notes'])
const LINK_KEEP = ['schema_version', 'date', 'from_airport', 'to_airport', 'mode', 'arrive_date', 'depart_time', 'arrive_time', 'operator']
const HOME_KEEP = ['schema_version', 'start_date', 'home_airports']

/** Reparse a CSV keeping only the allowed columns (drop set OR keep list), quote-safe via PapaParse. */
function scrubCsv(text, { drop, keep }) {
  const parsed = Papa.parse(text.trim(), { header: true, skipEmptyLines: true })
  const fields = (parsed.meta.fields || []).filter((f) => (keep ? keep.includes(f) : !drop.has(f)))
  const rows = parsed.data.map((r) => { const o = {}; for (const f of fields) o[f] = r[f] ?? ''; return o })
  return Papa.unparse({ fields, data: rows })
}

const flightsCsv = scrubCsv(readFileSync(FLIGHTS, 'utf8'), { drop: FLIGHT_DROP })
const homesCsv = scrubCsv(readFileSync(HOMES, 'utf8'), { keep: HOME_KEEP })
const linksCsv = scrubCsv(readFileSync(LINKS, 'utf8'), { keep: LINK_KEEP })
const payload = JSON.stringify({ v: 1, flightsCsv, homesCsv, linksCsv })

// ── AES-GCM encrypt with a PBKDF2 key derived from the code ──
const b64 = (u8) => Buffer.from(u8).toString('base64')
const enc = new TextEncoder()
const salt = wc.getRandomValues(new Uint8Array(16))
const iv = wc.getRandomValues(new Uint8Array(12))
const iterations = 250_000
const baseKey = await wc.subtle.importKey('raw', enc.encode(code), 'PBKDF2', false, ['deriveKey'])
const key = await wc.subtle.deriveKey({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, baseKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt'])
const ct = await wc.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(payload))

const blob = { v: 1, iter: iterations, salt: b64(salt), iv: b64(iv), ct: b64(new Uint8Array(ct)) }
mkdirSync(resolve(root, 'public'), { recursive: true })
writeFileSync(resolve(root, 'public/life.enc'), JSON.stringify(blob))

const flightCount = flightsCsv.trim().split(/\r?\n/).length - 1
console.log(`Wrote public/life.enc — ${flightCount} flights, ${(JSON.stringify(blob).length / 1024).toFixed(0)} KB ciphertext.`)
console.log(`Share link:  https://theonenonlyvj.github.io/see-me-fly/?k=${encodeURIComponent(code)}`)
