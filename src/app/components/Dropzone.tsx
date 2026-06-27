import { useRef, useState } from 'react'
import { readFileText, validateCsv } from '../csv/load-csv'

export default function Dropzone({ onLoaded }: { onLoaded: (text: string, fileName: string, remember: boolean) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [remember, setRemember] = useState(true)

  async function handleFile(file: File | undefined | null) {
    if (!file) return
    setError(null)
    const text = await readFileText(file)
    const { ok, missingColumns } = validateCsv(text)
    if (!ok) {
      setError(`"${file.name}" doesn't look like a flight logs CSV — missing columns: ${missingColumns.join(', ') || 'unknown'}.`)
      return
    }
    onLoaded(text, file.name, remember)
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); void handleFile(e.dataTransfer.files?.[0]) }}
      style={{
        height: '100%', display: 'grid', placeItems: 'center', textAlign: 'center', padding: 'var(--pad)',
        border: dragging ? '2px dashed var(--accent)' : '2px dashed var(--border)',
        margin: 24, borderRadius: 'var(--radius)', background: 'var(--bg-elev)',
      }}
    >
      <div>
        <h1 style={{ marginBottom: 8 }}>✈️ Flight Visualizer</h1>
        <p style={{ color: 'var(--text-dim)', maxWidth: 420, margin: '0 auto 20px' }}>
          Drop your flight logs CSV here (any export with the expected flight columns), or pick it. Everything stays on your machine.
        </p>
        <button
          onClick={() => inputRef.current?.click()}
          style={{ background: 'var(--accent)', color: '#06121f', border: 'none', borderRadius: 'var(--radius-sm)', padding: '10px 18px', fontWeight: 600 }}
        >
          Choose CSV…
        </button>
        <input
          ref={inputRef}
          data-testid="file-input"
          type="file"
          accept=".csv,text/csv"
          style={{ display: 'none' }}
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 18, color: 'var(--text-dim)', fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          Remember my flights on this device
        </label>
        <p style={{ color: 'var(--text-dim)', fontSize: 11.5, marginTop: 4, maxWidth: 420 }}>
          Saved only in this browser via localStorage — never uploaded. Uncheck to keep it one-time; clear it anytime with “Load a different CSV”.
        </p>
        {error && <p role="alert" style={{ color: 'var(--warn)', marginTop: 16, maxWidth: 420 }}>{error}</p>}
      </div>
    </div>
  )
}
