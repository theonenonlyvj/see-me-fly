export default function ScopeDropdown({ years, value, onChange }: { years: number[]; value: number | undefined; onChange: (y: number | undefined) => void }) {
  return (
    <select
      value={value ?? 'all'}
      onChange={(e) => onChange(e.target.value === 'all' ? undefined : Number(e.target.value))}
      style={{ background: 'var(--bg-elev)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '6px 10px' }}
    >
      <option value="all">All-time</option>
      {[...years].sort((a, b) => b - a).map((y) => <option key={y} value={y}>{y}</option>)}
    </select>
  )
}
