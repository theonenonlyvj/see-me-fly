import './app/styles/tokens.css'
import './app/styles/base.css'

export default function App() {
  return (
    <div style={{ padding: 'var(--pad)' }}>
      <h1>Flight Visualizer</h1>
      <p style={{ color: 'var(--text-dim)' }}>Drop a Flighty CSV export to begin.</p>
    </div>
  )
}
