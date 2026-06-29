import { useEffect, useMemo, useRef, useState } from 'react'
import { searchAirports, airportLabel, type AirportHit } from '../../lib/airport-search'

/**
 * A tiny autocomplete over the bundled airport reference. The user types a code, city,
 * or name; we surface ranked hits; selecting one stores its IATA CODE (the picker is
 * a code-picker — full geocoding of a non-airport place is out of scope, per spec).
 *
 * Controlled: `value` is the current code; `onChange(code)` fires on selection or when
 * the text is cleared. Matches SettingsPanel's input styling.
 */
const fieldStyle = {
  background: 'var(--bg-card)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '2px 6px',
} as const

export default function AirportPicker({
  value,
  onChange,
  placeholder,
  width = 150,
  ariaLabel,
}: {
  value: string
  onChange: (code: string) => void
  placeholder?: string
  width?: number
  ariaLabel?: string
}) {
  // Local text mirrors the displayed value; when a code is set we show its label.
  const [text, setText] = useState<string>(value ? airportLabel(value) : '')
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Resync the visible text when the controlled `value` changes EXTERNALLY (the picker instance is
  // reused across re-renders via a stable `key`, e.g. after a CSV import swaps the stored code).
  // The controlled value wins; we only re-seed when `value` actually changes (the dependency), so
  // typing-driven local `text` updates aren't clobbered mid-edit.
  useEffect(() => {
    setText(value ? airportLabel(value) : '')
  }, [value])

  const hits: AirportHit[] = useMemo(() => searchAirports(query, 8), [query])

  function pick(code: string) {
    onChange(code)
    setText(airportLabel(code))
    setQuery('')
    setOpen(false)
  }

  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <input
        type="text"
        aria-label={ariaLabel}
        value={text}
        placeholder={placeholder ?? 'Code / city'}
        onChange={(e) => {
          const v = e.target.value
          setText(v)
          setQuery(v)
          setOpen(true)
          if (v.trim() === '') onChange('')
        }}
        onFocus={() => { if (text.trim()) { setQuery(text); setOpen(true) } }}
        onBlur={() => {
          // Delay so a mousedown on an option still registers before we close.
          blurTimer.current = setTimeout(() => setOpen(false), 120)
        }}
        style={{ ...fieldStyle, width }}
      />
      {open && hits.length > 0 && (
        <ul
          style={{
            position: 'absolute',
            zIndex: 20,
            top: '100%',
            left: 0,
            margin: 0,
            padding: 0,
            listStyle: 'none',
            minWidth: width,
            maxHeight: 220,
            overflowY: 'auto',
            background: 'var(--bg-elev)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
          }}
        >
          {hits.map((h) => (
            <li key={h.code}>
              <button
                type="button"
                // mousedown fires before input blur — pick here so the option isn't lost.
                onMouseDown={(e) => { e.preventDefault(); if (blurTimer.current) clearTimeout(blurTimer.current); pick(h.code) }}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text)',
                  padding: '4px 8px',
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                <strong>{h.code}</strong>{' '}
                <span style={{ color: 'var(--text-dim)' }}>
                  {h.municipality || h.name}{h.region ? ` · ${h.region}` : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </span>
  )
}
