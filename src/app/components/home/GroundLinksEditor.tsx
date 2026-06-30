import { useState } from 'react'
import type { GroundLink } from '../../../engine'
import AirportPicker from './AirportPicker'
import OpenMojiIcon from '../OpenMojiIcon'

/**
 * Editor for user-entered significant ground segments (`Settings.groundLinks`). CORE per
 * row: date, fromAirport + toAirport (an airport picker — autocomplete over the bundled
 * reference; the user PICKS a code, full geocoding is out of scope), and a mode dropdown.
 * Everything else is OPTIONAL and collapsed behind a "more" toggle. Validation: a `price`
 * requires a `currency` (a priced-but-currency-less link is never summed downstream).
 *
 * Writes the whole array back via `onChange` on every edit (parent persists to localStorage).
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

const MODES = ['drive', 'bus', 'train', 'ferry', 'other'] as const

const MODE_ICON: Record<string, string> = {
  drive: '🚗', bus: '🚌', train: '🚆', ferry: '⛴️', other: '🧭',
}

// Optional fields rendered under "more", with a label and input type.
const OPTIONAL_FIELDS: ReadonlyArray<{ key: keyof GroundLink; label: string; type?: 'date' | 'time' | 'text' }> = [
  { key: 'fromPlace', label: 'From place' },
  { key: 'toPlace', label: 'To place' },
  { key: 'arriveDate', label: 'Arrive date', type: 'date' },
  { key: 'departTime', label: 'Depart time', type: 'time' },
  { key: 'arriveTime', label: 'Arrive time', type: 'time' },
  { key: 'operator', label: 'Operator' },
  { key: 'bookingRef', label: 'Booking ref' },
  { key: 'seat', label: 'Seat' },
  { key: 'klass', label: 'Class' },
  { key: 'note', label: 'Note' },
]

export default function GroundLinksEditor({
  groundLinks,
  onChange,
}: {
  groundLinks: GroundLink[]
  onChange: (links: GroundLink[]) => void
}) {
  const links = groundLinks
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  function patch(i: number, next: Partial<GroundLink>) {
    onChange(links.map((l, idx) => (idx === i ? cleanLink({ ...l, ...next }) : l)))
  }
  function addLink() {
    onChange([...links, { date: '', fromAirport: '', toAirport: '', mode: 'drive' }])
  }
  function removeLink(i: number) {
    onChange(links.filter((_, idx) => idx !== i))
    setExpanded((prev) => {
      const n = new Set<number>()
      for (const x of prev) if (x < i) n.add(x); else if (x > i) n.add(x - 1)
      return n
    })
  }
  function toggleMore(i: number) {
    setExpanded((prev) => {
      const n = new Set(prev)
      if (n.has(i)) n.delete(i); else n.add(i)
      return n
    })
  }

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>
        Optional. Record significant non-flight legs (a relocation drive, an overnight bus)
        so trip reconstruction can bridge the gaps between flights. Ground links never change
        any flight count or distance.
      </div>

      {links.length === 0 && (
        <div style={{ color: 'var(--text-dim)', fontSize: 13, fontStyle: 'italic' }}>
          No ground links yet.
        </div>
      )}

      {links.map((link, i) => {
        const priceMissingCurrency = link.price != null && !(link.currency && link.currency.trim())
        const isOpen = expanded.has(i)
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
              <input
                type="date"
                aria-label={`link ${i + 1} date`}
                value={link.date}
                onChange={(e) => patch(i, { date: e.target.value })}
                style={fieldStyle}
              />
              <AirportPicker
                value={link.fromAirport}
                ariaLabel={`link ${i + 1} from airport`}
                placeholder="From"
                width={130}
                onChange={(code) => patch(i, { fromAirport: code })}
              />
              <span style={{ color: 'var(--text-dim)' }}>→</span>
              <AirportPicker
                value={link.toAirport}
                ariaLabel={`link ${i + 1} to airport`}
                placeholder="To"
                width={130}
                onChange={(code) => patch(i, { toAirport: code })}
              />
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <OpenMojiIcon emoji={MODE_ICON[link.mode] ?? '🧭'} size={18} />
                <select
                  aria-label={`link ${i + 1} mode`}
                  value={link.mode}
                  onChange={(e) => patch(i, { mode: e.target.value })}
                  style={fieldStyle}
                >
                  {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </span>
              <button type="button" onClick={() => toggleMore(i)} style={smallBtn}>
                {isOpen ? 'Less' : 'More'}
              </button>
              <button type="button" onClick={() => removeLink(i)} style={smallBtn} aria-label={`remove link ${i + 1}`}>Remove</button>
            </div>

            {isOpen && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 6 }}>
                {OPTIONAL_FIELDS.map(({ key, label, type }) => (
                  <label key={String(key)} style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12, color: 'var(--text-dim)' }}>
                    {label}
                    <input
                      type={type ?? 'text'}
                      aria-label={`link ${i + 1} ${label}`}
                      value={(link[key] as string | undefined) ?? ''}
                      onChange={(e) => patch(i, { [key]: e.target.value || undefined } as Partial<GroundLink>)}
                      style={fieldStyle}
                    />
                  </label>
                ))}
                {/* price + currency live together so the validation reads naturally */}
                <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12, color: 'var(--text-dim)' }}>
                  Price
                  <input
                    type="number"
                    aria-label={`link ${i + 1} price`}
                    value={link.price ?? ''}
                    onChange={(e) => {
                      const v = e.target.value
                      patch(i, { price: v === '' ? undefined : Number(v) })
                    }}
                    style={fieldStyle}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12, color: 'var(--text-dim)' }}>
                  Currency
                  <input
                    type="text"
                    aria-label={`link ${i + 1} currency`}
                    placeholder="USD / MXN…"
                    value={link.currency ?? ''}
                    onChange={(e) => patch(i, { currency: e.target.value || undefined })}
                    style={fieldStyle}
                  />
                </label>
              </div>
            )}

            {priceMissingCurrency && (
              <div style={{ color: 'var(--danger, #d33)', fontSize: 12 }}>
                A currency is required when a price is set (a priced link without a currency is never summed).
              </div>
            )}
          </div>
        )
      })}

      <button type="button" onClick={addLink} style={{ ...smallBtn, justifySelf: 'start' }}>
        + Add ground link
      </button>
    </div>
  )
}

/** Drop optional keys that became blank so the stored object stays clean (no empty strings). */
function cleanLink(l: GroundLink): GroundLink {
  const out = { ...l }
  for (const k of Object.keys(out) as (keyof GroundLink)[]) {
    const v = out[k]
    if (v === '' || v === undefined) {
      if (k !== 'date' && k !== 'fromAirport' && k !== 'toAirport' && k !== 'mode') {
        delete out[k]
      }
    }
  }
  return out
}
