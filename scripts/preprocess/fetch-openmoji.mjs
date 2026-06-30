// Fetch OpenMoji COLOR svgs (UNMODIFIED, CC BY-SA 4.0) for the app's card-header
// icons + ground-link mode icons, bundling them offline under src/assets/openmoji/.
//
// OpenMoji filename rule: the emoji's Unicode codepoints, dropping FE0F (VS-16),
// each hex-uppercased & zero-padded to 4, joined by '-'. For any 404 we retry with
// FE0F KEPT (a few OpenMoji files include it) and log the outcome.
//
// Run: node scripts/preprocess/fetch-openmoji.mjs
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = resolve(__dirname, '../../src/assets/openmoji')
const BASE = 'https://raw.githubusercontent.com/hfg-gmuend/openmoji/master/color/svg'

// Card-header icons (every distinct `icon: '…'` under src/app/cards) + ground-link
// mode icons (drive/bus/train/ferry/other). De-duplicated by Set.
const EMOJI = [...new Set([
  '⏰', '✂️', '✈️', '🌍', '🌎', '🌐', '🌙', '🎟️', '🏆', '🏙️', '🏠', '📅',
  '📈', '📍', '📏', '🔁', '🔧', '🗓️', '🗺️', '😤', '🛏️', '🛣️', '🛩️', '🛫',
  '🛬', '🤝', '🧭', '🪦', '🪪',
  // ground-link modes
  '🚗', '🚌', '🚆', '⛴️', '🧭',
])]

/** OpenMoji name: codepoints, FE0F stripped, hex-upper-padded(4), '-' joined. */
function nameNoFE0F(emoji) {
  return [...emoji]
    .map((c) => c.codePointAt(0))
    .filter((cp) => cp !== 0xfe0f)
    .map((cp) => cp.toString(16).toUpperCase().padStart(4, '0'))
    .join('-')
}
/** Alternate: keep FE0F (some OpenMoji files include the VS-16). */
function nameWithFE0F(emoji) {
  return [...emoji]
    .map((c) => c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0'))
    .join('-')
}

async function tryFetch(name) {
  const url = `${BASE}/${name}.svg`
  const res = await fetch(url)
  return { ok: res.status === 200, status: res.status, name, url, res }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  const report = []
  for (const emoji of EMOJI) {
    const primary = nameNoFE0F(emoji)
    let r = await tryFetch(primary)
    if (!r.ok) {
      console.log(`[non-200] ${emoji} → ${primary}.svg  (HTTP ${r.status}) — retrying with FE0F kept`)
      const alt = nameWithFE0F(emoji)
      if (alt !== primary) {
        const r2 = await tryFetch(alt)
        if (r2.ok) r = r2
        else console.log(`[non-200] ${emoji} → ${alt}.svg  (HTTP ${r2.status})`)
      }
    }
    if (!r.ok) {
      report.push({ emoji, name: primary, status: 'FAILED' })
      console.log(`  ✗ FAILED to fetch a file for ${emoji}`)
      continue
    }
    const svg = await r.res.text()
    const file = resolve(OUT_DIR, `${r.name}.svg`)
    await writeFile(file, svg, 'utf8')
    report.push({ emoji, name: r.name, status: 'ok', bytes: svg.length })
    console.log(`  ✓ ${emoji}  →  ${r.name}.svg  (${svg.length} bytes)`)
  }
  const failed = report.filter((x) => x.status !== 'ok')
  console.log(`\nDone: ${report.length - failed.length}/${report.length} fetched, ${failed.length} failed.`)
  if (failed.length) {
    console.log('FAILED:', failed.map((x) => `${x.emoji} (${x.name})`).join(', '))
    process.exitCode = 1
  }
}

main()
