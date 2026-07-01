// Renders data-viz mockup HTML cards to PNGs for side-by-side review.
// Each *.html in the target dir must contain the literal token /*__FONTS__*/ in a <style>;
// this injects the real bundled Fraunces+Inter as @font-face data-URIs, then screenshots the
// 680x520 frame with headless Chrome at 2x. Usage:
//   node scripts/preprocess/render-mockups.mjs <dir>
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '../..')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const dir = resolve(root, process.argv[2] || '.dataviz-mockups')

const b64 = (p) => readFileSync(resolve(root, p)).toString('base64')
const fraunces = b64('node_modules/@fontsource-variable/fraunces/files/fraunces-latin-full-normal.woff2')
const inter = b64('node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2')
const FONTFACE = `
@font-face{font-family:'Fraunces';src:url(data:font/woff2;base64,${fraunces}) format('woff2');font-weight:100 900;font-display:block;}
@font-face{font-family:'Inter';src:url(data:font/woff2;base64,${inter}) format('woff2');font-weight:100 900;font-display:block;}
`.trim()

const htmls = readdirSync(dir).filter((f) => f.endsWith('.html') && !f.endsWith('.rendered.html'))
for (const f of htmls) {
  const src = readFileSync(join(dir, f), 'utf8')
  const injected = src.includes('/*__FONTS__*/')
    ? src.replace('/*__FONTS__*/', FONTFACE)
    : src.replace('</head>', `<style>${FONTFACE}</style></head>`) // fallback if token missing
  const renderedPath = join(dir, f.replace(/\.html$/, '.rendered.html'))
  const pngPath = join(dir, f.replace(/\.html$/, '.png'))
  writeFileSync(renderedPath, injected)
  execFileSync(CHROME, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars',
    '--force-device-scale-factor=2',
    '--window-size=680,520',
    '--default-background-color=00000000',
    `--screenshot=${pngPath}`,
    `file://${renderedPath}`,
  ], { stdio: 'ignore' })
  console.log(`rendered ${f} -> ${pngPath.split('/').pop()}`)
}
console.log(`\nDone: ${htmls.length} mockups in ${dir}`)
