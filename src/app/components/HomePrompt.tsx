import { useState } from 'react'
import type { CSSProperties } from 'react'
import type { Settings } from '../../engine'
import AirportPicker from './home/AirportPicker'

/**
 * A single friendly, dismissible prompt shown at the top of the loaded dashboard when no home is
 * set. Picking an airport sets the simple single `home` (lighting up the trips / nights-away /
 * farthest-from-home cards); "Skip for now" hides it for good via the dismiss flag in App.
 *
 * Visibility (no-home AND not-dismissed) is decided by the parent — this component just renders the
 * banner. The full home-timeline editor (Settings → advanced) is unchanged; this only sets `home`.
 */
const bannerStyle: CSSProperties = {
  position: 'relative',
  background: 'var(--card)',
  border: '1px solid var(--hair)',
  borderRadius: 'var(--radius)',
  padding: '16px 22px',
  marginBottom: '24px',
  boxShadow: 'var(--shadow)',
  overflow: 'hidden',
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 14,
}

export default function HomePrompt({
  update,
  onSkip,
}: {
  update: (patch: Partial<Settings>) => void
  onSkip: () => void
}) {
  const [code, setCode] = useState('')

  return (
    <section style={bannerStyle} aria-label="Set your home airport">
      {/* top accent strip, matching CardFrame */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 6, background: 'var(--coral)' }} />
      <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }} aria-hidden>📍</span>
      <span style={{ flex: '1 1 260px', fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
        Set your home airport to unlock trips, nights away, and farthest-from-home.
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <AirportPicker
          value={code}
          onChange={(c) => {
            setCode(c)
            if (c) update({ home: c })
          }}
          ariaLabel="Home airport"
          placeholder="Home airport"
          width={170}
        />
        <button
          type="button"
          onClick={onSkip}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--ink-2)',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          Skip for now
        </button>
      </span>
    </section>
  )
}
