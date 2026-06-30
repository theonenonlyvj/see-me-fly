import type { HomeEra } from '../../../engine'
import { airportKey } from '../../../engine/normalize'
import AirportPicker from './AirportPicker'

/**
 * Editor for the time-keyed home timeline (`Settings.homeHistory`). Each era = a start
 * date + one-or-more airports (the FIRST is PRIMARY) + an optional label. Add / remove /
 * reorder; live (non-blocking) validation. Writes the whole array back via `onChange` on
 * every edit — the parent persists it to localStorage through the settings-update path.
 *
 * Ships EMPTY: with no eras the timeline is clearly optional and the single `home` field
 * (rendered by SettingsPanel) remains the backward-compat default.
 */

const fieldStyle = {
  background: 'var(--bg-card)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '2px 6px',
} as const

const smallBtn = {
  background: 'transparent',
  border: '1px solid var(--border)',
  color: 'var(--text-dim)',
  borderRadius: 'var(--radius-sm)',
  padding: '2px 8px',
  cursor: 'pointer',
} as const

/** Per-era validation messages (warnings are non-blocking). */
interface EraIssues {
  error?: string
  warning?: string
}

function eraIssues(eras: HomeEra[], i: number, groupAirports: boolean): EraIssues {
  const era = eras[i]
  const out: EraIssues = {}
  if (!era.airports || era.airports.length === 0) {
    out.error = 'Add at least one airport for this era.'
  }
  // Ascending start dates: each era's start must be strictly after the previous one's.
  if (i > 0 && era.start && eras[i - 1].start && era.start <= eras[i - 1].start) {
    out.error = out.error
      ? out.error
      : `Start dates must be in ascending order (this era starts on/before the one above).`
  }
  // Warn (non-blocking) if one era's airports span more than one airportKey group when
  // grouping is on — one base per era is the model (e.g. mixing Denver + Seattle keys).
  if (groupAirports && era.airports && era.airports.length > 1) {
    const keys = new Set(era.airports.map((a) => airportKey(a, groupAirports)))
    if (keys.size > 1) {
      out.warning = 'These airports span more than one metro group — an era should be one base.'
    }
  }
  return out
}

export default function HomeHistoryEditor({
  homeHistory,
  groupAirports,
  onChange,
}: {
  homeHistory: HomeEra[]
  groupAirports: boolean
  onChange: (eras: HomeEra[]) => void
}) {
  const eras = homeHistory

  function patch(i: number, next: Partial<HomeEra>) {
    onChange(eras.map((e, idx) => (idx === i ? { ...e, ...next } : e)))
  }
  function addEra() {
    onChange([...eras, { start: '', airports: [] }])
  }
  function removeEra(i: number) {
    onChange(eras.filter((_, idx) => idx !== i))
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= eras.length) return
    const copy = eras.slice()
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
    onChange(copy)
  }
  function addAirport(i: number, code: string) {
    if (!code) return
    const era = eras[i]
    if (era.airports.includes(code)) return
    patch(i, { airports: [...era.airports, code] })
  }
  function removeAirport(i: number, code: string) {
    const era = eras[i]
    patch(i, { airports: era.airports.filter((c) => c !== code) })
  }
  function makePrimary(i: number, code: string) {
    const era = eras[i]
    patch(i, { airports: [code, ...era.airports.filter((c) => c !== code)] })
  }

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>
        Optional. Add the homes you've had over time so home-relative stats reflect where you
        lived on each flight's date. Leave empty to use the single Home base above.
      </div>

      {eras.length === 0 && (
        <div style={{ color: 'var(--text-dim)', fontSize: 13, fontStyle: 'italic' }}>
          No home eras yet — your single Home base is used everywhere.
        </div>
      )}

      {eras.map((era, i) => {
        const issues = eraIssues(eras, i, groupAirports)
        return (
          <div
            key={i}
            style={{
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: 8,
              display: 'grid',
              gap: 6,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                From
                <input
                  type="date"
                  aria-label={`era ${i + 1} start date`}
                  value={era.start}
                  onChange={(e) => patch(i, { start: e.target.value })}
                  style={fieldStyle}
                />
              </label>
              <input
                type="text"
                aria-label={`era ${i + 1} label`}
                placeholder="Label (optional)"
                value={era.label ?? ''}
                onChange={(e) => patch(i, { label: e.target.value || undefined })}
                style={{ ...fieldStyle, flex: 1, minWidth: 120 }}
              />
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} style={smallBtn} aria-label={`move era ${i + 1} up`}>↑</button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === eras.length - 1} style={smallBtn} aria-label={`move era ${i + 1} down`}>↓</button>
              <button type="button" onClick={() => removeEra(i)} style={smallBtn} aria-label={`remove era ${i + 1}`}>Remove</button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {era.airports.map((code, ai) => (
                <span
                  key={code}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 999,
                    padding: '1px 8px',
                    fontSize: 13,
                  }}
                >
                  {ai === 0 ? (
                    <strong title="Primary airport (the single reference point)" style={{ color: 'var(--accent, var(--text))' }}>{code} ★</strong>
                  ) : (
                    <button
                      type="button"
                      onClick={() => makePrimary(i, code)}
                      title="Make primary"
                      style={{ background: 'transparent', border: 'none', color: 'var(--text)', cursor: 'pointer', padding: 0 }}
                    >
                      {code}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removeAirport(i, code)}
                    aria-label={`remove airport ${code} from era ${i + 1}`}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 0 }}
                  >
                    ×
                  </button>
                </span>
              ))}
              <AirportPicker
                value=""
                ariaLabel={`add airport to era ${i + 1}`}
                placeholder="Add airport…"
                width={130}
                onChange={(code) => addAirport(i, code)}
              />
            </div>

            {issues.error && (
              <div style={{ color: 'var(--danger, #d33)', fontSize: 12 }}>{issues.error}</div>
            )}
            {issues.warning && (
              <div style={{ color: 'var(--warn, #c80)', fontSize: 12 }}>⚠ {issues.warning}</div>
            )}
            {era.airports.length > 0 && (
              <div style={{ color: 'var(--text-dim)', fontSize: 11 }}>
                Primary: {era.airports[0]}{era.airports.length > 1 ? ` · co-home: ${era.airports.slice(1).join(', ')}` : ''}
              </div>
            )}
          </div>
        )
      })}

      <button type="button" onClick={addEra} style={{ ...smallBtn, justifySelf: 'start' }}>
        + Add home era
      </button>
    </div>
  )
}
