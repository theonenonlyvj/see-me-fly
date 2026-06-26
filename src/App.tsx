import { useState } from 'react'
import './app/styles/tokens.css'
import './app/styles/base.css'
import Dropzone from './app/components/Dropzone'

export default function App() {
  const [csv, setCsv] = useState<{ text: string; name: string } | null>(null)

  if (!csv) return <Dropzone onLoaded={(text, name) => setCsv({ text, name })} />

  return (
    <div style={{ padding: 'var(--pad)' }}>
      <p style={{ color: 'var(--text-dim)' }}>Loaded {csv.name}. Dashboard coming online…</p>
    </div>
  )
}
