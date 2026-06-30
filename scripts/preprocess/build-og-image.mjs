// Builds the social link-preview image (public/og-image.png, 1200x630) used by
// the Open Graph / Twitter-card meta tags in index.html. WhatsApp/iMessage/Slack
// fetch that absolute-URL PNG to render the share card.
//
// Approach: render an on-brand HTML card with the real bundled fonts embedded as
// data URIs, screenshot it with headless Chrome at 2x, then downscale to exactly
// 1200x630 for crisp anti-aliasing. Regenerate with:
//   node scripts/preprocess/build-og-image.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '../..')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const b64 = (p) => readFileSync(resolve(root, p)).toString('base64')
const fraunces = b64('node_modules/@fontsource-variable/fraunces/files/fraunces-latin-full-normal.woff2')
const inter = b64('node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2')

// 1200x630 card. The hero gradient is the app's 6-stop wordmark gradient.
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  @font-face{font-family:'Fraunces';src:url(data:font/woff2;base64,${fraunces}) format('woff2');font-weight:100 900;}
  @font-face{font-family:'Inter';src:url(data:font/woff2;base64,${inter}) format('woff2');font-weight:100 900;}
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body{width:1200px;height:630px;overflow:hidden;}
  .card{
    width:1200px;height:630px;position:relative;
    display:flex;flex-direction:column;justify-content:center;
    padding:0 96px;
    background:linear-gradient(110deg,#ff3d57 0%,#ff7a14 22%,#ff2fa8 52%,#6a3cff 84%,#1aa9ff 100%);
    color:#fff;font-family:'Inter',sans-serif;
  }
  /* soft luminous blooms for depth */
  .bloom{position:absolute;border-radius:50%;filter:blur(8px);pointer-events:none;}
  .b1{top:-160px;right:-120px;width:520px;height:520px;background:rgba(255,255,255,0.18);}
  .b2{bottom:-200px;left:-140px;width:480px;height:480px;background:rgba(255,255,255,0.10);}
  .plane{font-size:78px;line-height:1;margin-bottom:18px;filter:drop-shadow(0 8px 22px rgba(20,20,28,0.28));}
  .wordmark{
    font-family:'Fraunces',serif;font-weight:340;font-size:148px;line-height:0.94;
    letter-spacing:-0.03em;
    text-shadow:0 6px 30px rgba(20,20,28,0.22);
  }
  .desc{
    margin-top:30px;font-size:31px;font-weight:600;line-height:1.34;max-width:760px;
    color:rgba(255,255,255,0.94);
  }
  .url{
    position:absolute;left:96px;bottom:54px;
    font-size:23px;font-weight:700;letter-spacing:0.01em;
    color:rgba(255,255,255,0.92);
    display:flex;align-items:center;gap:11px;
  }
  .dot{width:11px;height:11px;border-radius:50%;background:#fff;box-shadow:0 0 0 5px rgba(255,255,255,0.28);}
</style></head><body>
  <div class="card">
    <div class="bloom b1"></div><div class="bloom b2"></div>
    <div class="plane">&#9992;&#65039;</div>
    <div class="wordmark">See Me Fly</div>
    <div class="desc">Upload a flight-log CSV for an instant dashboard of your travels &mdash; routes, airports, countries, and maps. 100% local, nothing uploaded.</div>
    <div class="url"><span class="dot"></span>theonenonlyvj.github.io/see-me-fly</div>
  </div>
</body></html>`

const scratch = resolve(root, 'scripts/preprocess/.og-tmp')
mkdirSync(scratch, { recursive: true })
const htmlPath = resolve(scratch, 'og-card.html')
const rawPng = resolve(scratch, 'og-raw.png')
const outPng = resolve(root, 'public/og-image.png')
mkdirSync(resolve(root, 'public'), { recursive: true })
writeFileSync(htmlPath, html)

// Render at 2x for crispness, then downscale to the canonical 1200x630.
execFileSync(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars',
  '--force-device-scale-factor=2',
  '--window-size=1200,630',
  `--screenshot=${rawPng}`,
  `file://${htmlPath}`,
], { stdio: 'inherit' })

execFileSync('sips', ['-z', '630', '1200', rawPng, '--out', outPng], { stdio: 'inherit' })
console.log(`\nWrote ${outPng}`)
