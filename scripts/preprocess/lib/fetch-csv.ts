import Papa from 'papaparse'

export async function fetchCsv(url: string): Promise<Record<string, string>[]> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Fetch failed ${res.status}: ${url}`)
  const text = await res.text()
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    worker: false,
  })
  if (parsed.errors.length) {
    const sample = parsed.errors.slice(0, 3).map((e) => e.message).join('; ')
    console.warn(`CSV parse warnings (${parsed.errors.length}): ${sample}`)
  }
  return parsed.data
}
