import ScopeDropdown from './ScopeDropdown'

export default function TopBar({ fileName, years, scope, onScope, onToggleSettings }: {
  fileName: string; years: number[]; scope: number | undefined; onScope: (y: number | undefined) => void; onToggleSettings: () => void
}) {
  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 5, display: 'flex', alignItems: 'center', gap: 12, padding: '10px var(--pad)', background: 'var(--bg-elev)', borderBottom: '1px solid var(--border)' }}>
      <strong style={{ fontSize: 16 }}>✈️ Flight Visualizer</strong>
      <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>{fileName}</span>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
        <ScopeDropdown years={years} value={scope} onChange={onScope} />
        <button onClick={onToggleSettings} style={{ background: 'var(--bg-card)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '6px 12px' }}>⚙ Settings</button>
      </div>
    </header>
  )
}
