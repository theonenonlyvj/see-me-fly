// Opt-in local persistence of the loaded flight-logs CSV. Stored ONLY in the user's browser
// (localStorage) — never uploaded anywhere. Lets a returning visitor skip re-importing their file.

export const CSV_KEY = 'flightviz:csv:v1'

function safeStorage(storage?: Storage): Storage | null {
  if (storage) return storage
  try { return window.localStorage } catch { return null }
}

export interface SavedCsv { name: string; text: string }

export function saveCsv(name: string, text: string, storage?: Storage): void {
  const s = safeStorage(storage)
  if (!s) return
  try { s.setItem(CSV_KEY, JSON.stringify({ name, text })) } catch { /* quota exceeded — silently skip */ }
}

export function loadCsv(storage?: Storage): SavedCsv | null {
  const s = safeStorage(storage)
  if (!s) return null
  const raw = s.getItem(CSV_KEY)
  if (!raw) return null
  try {
    const p = JSON.parse(raw) as Partial<SavedCsv>
    return (typeof p?.text === 'string' && typeof p?.name === 'string') ? { name: p.name, text: p.text } : null
  } catch {
    return null
  }
}

export function clearCsv(storage?: Storage): void {
  const s = safeStorage(storage)
  if (!s) return
  s.removeItem(CSV_KEY)
}
