import { useState } from 'react'
import { groups, airportToGroup, lookupAirport } from '../../engine/reference'
import type { Settings, EnrichedFlight } from '../../engine'

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}

export default function SettingsPanel({ settings, update, reset, onReplace, flown }: {
  settings: Settings
  update: (patch: Partial<Settings>) => void
  reset: () => void
  onReplace: () => void
  flown: EnrichedFlight[]
}) {
  const [showGroups, setShowGroups] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // active groups = those with >=1 member airport present in the loaded+filtered set
  const present = new Set<string>()
  for (const f of flown) { if (f.fromCode) present.add(f.fromCode); if (f.toCode) present.add(f.toCode) }
  const activeGroups = groups.filter((g) => g.airports.some((a) => present.has(a)))

  // Home picker: metro groups present + the most-visited solo airports (not in any group).
  const counts = new Map<string, number>()
  for (const f of flown) {
    if (f.fromCode) counts.set(f.fromCode, (counts.get(f.fromCode) ?? 0) + 1)
    if (f.toCode) counts.set(f.toCode, (counts.get(f.toCode) ?? 0) + 1)
  }
  const firstPresent = (g: { airports: string[] }) => g.airports.find((a) => present.has(a)) ?? g.airports[0]
  const soloAirports = [...present]
    .filter((c) => !airportToGroup.has(c.toUpperCase()))
    .sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0))
    .slice(0, 15)
  const homeSelectValue = (() => {
    const h = settings.home
    if (!h) return ''
    const gName = airportToGroup.get(h.toUpperCase())
    if (gName) { const g = activeGroups.find((x) => x.name === gName); if (g) return firstPresent(g) }
    return h
  })()

  const fieldStyle = { background: 'var(--bg-card)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 6px' } as const

  return (
    <div style={{ background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 'var(--pad)', display: 'grid', gap: 12 }}>
      <Toggle label="Group nearby airports into metros" checked={settings.groupAirports} onChange={(v) => update({ groupAirports: v })} />
      {settings.groupAirports && (
        <button onClick={() => setShowGroups((v) => !v)} style={{ justifySelf: 'start', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-dim)', borderRadius: 'var(--radius-sm)', padding: '3px 10px' }}>
          {showGroups ? 'Hide groupings' : `View groupings (${activeGroups.length} active)`}
        </button>
      )}
      {showGroups && (
        <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--text-dim)', fontSize: 13 }}>
          {activeGroups.map((g) => <li key={g.name}><strong style={{ color: 'var(--text)' }}>{g.name}</strong>: {g.airports.filter((a) => present.has(a)).join(', ')}</li>)}
        </ul>
      )}
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        Home base
        <select value={homeSelectValue} onChange={(e) => update({ home: e.target.value || null })} style={fieldStyle}>
          <option value="">None</option>
          {activeGroups.map((g) => <option key={g.name} value={firstPresent(g)}>{g.name}</option>)}
          {soloAirports.map((c) => {
            const ap = lookupAirport(c)
            return <option key={c} value={c}>{ap?.municipality ? `${ap.municipality} (${c})` : c}</option>
          })}
        </select>
        <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>(routes lead with home; sets farthest-from-home)</span>
      </label>

      <Toggle label="Treat A→B and B→A as different routes (explicitly unique)" checked={settings.explicitlyUnique} onChange={(v) => update({ explicitlyUnique: v })} />
      <Toggle label="Include canceled flights" checked={settings.includeCanceled} onChange={(v) => update({ includeCanceled: v })} />
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input type="checkbox" checked={settings.excludeBeforeDate !== null} onChange={(e) => update({ excludeBeforeDate: e.target.checked ? '2001-01-01' : null })} />
        Exclude flights before
        <input type="date" disabled={settings.excludeBeforeDate === null} value={settings.excludeBeforeDate ?? ''} onChange={(e) => update({ excludeBeforeDate: e.target.value || null })}
          style={{ background: 'var(--bg-card)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 6px' }} />
      </label>

      <button onClick={() => setShowAdvanced((v) => !v)} style={{ justifySelf: 'start', background: 'transparent', border: 'none', color: 'var(--text-dim)', padding: 0, textDecoration: 'underline' }}>
        {showAdvanced ? 'Hide advanced' : 'Advanced (duration estimate)'}
      </button>
      {showAdvanced && (
        <div style={{ display: 'grid', gap: 6, fontSize: 13 }}>
          {([['cruiseMph', 'Cruise mph'], ['taxiMin', 'Taxi min'], ['climbDescentMin', 'Climb/descent min'], ['gateTaxiMin', 'Gate taxi min'], ['localFlightDefaultMin', 'Local-flight default min']] as const).map(([key, label]) => (
            <label key={key} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              {label}
              <input type="number" value={settings.duration[key]} onChange={(e) => update({ duration: { ...settings.duration, [key]: Number(e.target.value) } })}
                style={{ width: 80, background: 'var(--bg-card)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 6px' }} />
            </label>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button onClick={reset} style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-dim)', borderRadius: 'var(--radius-sm)', padding: '4px 10px' }}>Reset settings</button>
        <button onClick={onReplace} style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-dim)', borderRadius: 'var(--radius-sm)', padding: '4px 10px' }}>Load a different CSV</button>
      </div>
    </div>
  )
}
