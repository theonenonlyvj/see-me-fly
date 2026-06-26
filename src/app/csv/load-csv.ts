import { parseFlightyCsv } from '../../engine/parse'

export function validateCsv(text: string): { ok: boolean; missingColumns: string[]; rowCount: number } {
  const { rows, headerOk, missingColumns } = parseFlightyCsv(text)
  return { ok: headerOk, missingColumns, rowCount: rows.length }
}

export function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('File read failed'))
    reader.readAsText(file)
  })
}
