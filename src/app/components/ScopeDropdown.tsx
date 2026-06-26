export default function ScopeDropdown({ years, value, onChange }: { years: number[]; value: number | undefined; onChange: (y: number | undefined) => void }) {
  return (
    <select
      value={value ?? 'all'}
      onChange={(e) => onChange(e.target.value === 'all' ? undefined : Number(e.target.value))}
      style={{
        background: 'transparent',
        color: 'var(--indigo)',
        border: 'none',
        fontFamily: 'var(--font)',
        fontSize: 13.5,
        fontWeight: 700,
        cursor: 'pointer',
        outline: 'none',
        padding: 0,
      }}
    >
      <option value="all">All-time</option>
      {[...years].sort((a, b) => b - a).map((y) => <option key={y} value={y}>{y}</option>)}
    </select>
  )
}
