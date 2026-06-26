import { statSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const DIR = resolve(here, '../../src/reference')
const BUDGET_BYTES = 8 * 1024 * 1024

let total = 0
for (const f of readdirSync(DIR)) {
  if (!f.endsWith('.json')) continue
  const bytes = statSync(join(DIR, f)).size
  total += bytes
  console.log(`${f}: ${(bytes / 1024).toFixed(0)} KB`)
}
console.log(`TOTAL reference JSON: ${(total / 1024 / 1024).toFixed(2)} MB (budget ${BUDGET_BYTES / 1024 / 1024} MB)`)
if (total > BUDGET_BYTES) {
  console.error('Reference JSON exceeds budget — tighten the airports.json filter.')
  process.exit(1)
}
