import { useEffect, useState } from 'react'
import CardFrame from '../components/CardFrame'
import BarList from '../components/charts/BarList'
import { distanceBucketsFor, sanitizeEdges, DEFAULT_DISTANCE_EDGES } from '../../engine/aggregate'
import { flightsByDistanceBand } from '../lib/flight-filters'
import type { CardContext, CardDef } from './registry'

const ACCENT      = '#ff7a14'
const ACCENT_GRAD = 'linear-gradient(90deg, #ff7a14, #ffb347)'
const ACCENT_SOFT = '#ffeedd'

/** Inline editor: one text box per band's upper edge (mi). Commits on blur/Enter; edits that
 *  would change the band count (blank), go non-positive, or duplicate an edge revert silently. */
function BandEditor({ edges, onCommit, onReset }: { edges: number[]; onCommit: (edges: number[]) => void; onReset: () => void }) {
  const [draft, setDraft] = useState(() => edges.map(String))
  // Resync only when the committed edges actually change (not on every keystroke).
  useEffect(() => { setDraft(edges.map(String)) }, [edges.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  const commit = () => {
    // Round first — the engine's sanitizeEdges rounds+dedups, so validating raw floats would let
    // e.g. 300 & 300.4 pass this dedup yet collapse to one band downstream (an input box vanishes).
    const nums = draft.map((s) => Math.round(Number(s.replace(/[, ]/g, ''))))
    if (nums.some((n) => !Number.isFinite(n) || n <= 0) || new Set(nums).size !== nums.length) {
      setDraft(edges.map(String)) // invalid (blank/dup/non-positive/rounds-to-collision) → revert, keep band count stable
      return
    }
    const sorted = [...nums].sort((a, b) => a - b)
    if (sorted.join(',') !== edges.join(',')) onCommit(sorted)
    else setDraft(edges.map(String)) // normalize display (strip commas/spaces) when unchanged
  }

  const isDefault = edges.join(',') === DEFAULT_DISTANCE_EDGES.join(',')

  return (
    <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--hair-2)', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
      <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-2)' }}>
        Band edges (mi)
      </span>
      {draft.map((v, i) => (
        <input
          key={i}
          aria-label={`Distance band edge ${i + 1}`}
          value={v}
          inputMode="numeric"
          onChange={(e) => setDraft((d) => d.map((x, j) => (j === i ? e.target.value : x)))}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          style={{
            width: 58, padding: '4px 6px', fontSize: 12.5, fontWeight: 700, textAlign: 'center',
            border: '1px solid var(--hair)', borderRadius: 7, background: 'var(--card)', color: 'var(--ink)',
            fontVariantNumeric: 'tabular-nums',
          }}
        />
      ))}
      {!isDefault && (
        <button onClick={onReset} style={{ fontSize: 11.5, fontWeight: 800, color: ACCENT, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
          Reset
        </button>
      )}
    </div>
  )
}

export const distanceCard: CardDef = {
  id: 'distance',
  title: 'How far',
  group: 'core',
  accent: ACCENT,
  icon: '📏',
  render: ({ model, overlay, settings, update }: CardContext) => {
    const edges = sanitizeEdges(settings.distanceEdges)
    const bands = distanceBucketsFor(model!.scoped, edges)
    const rows = bands.map((b, i) => ({ label: b.label, value: b.count, id: String(i) }))
    return (
      <CardFrame title="How far" eyebrow="Distance bands" accent={ACCENT} accentGrad={ACCENT_GRAD} accentSoft={ACCENT_SOFT} icon="📏"
        onTitleClick={() => overlay?.openFlights('How far', model!.scoped)}>
        <BarList rows={rows} max={rows.length} formatValue={(n) => `${n}`} accent={ACCENT} accentGrad={ACCENT_GRAD} accentSoft={ACCENT_SOFT}
          onRowClick={(row) => {
            const b = bands[Number(row.id)]
            overlay?.openFlights(`${row.label} flights`, flightsByDistanceBand(model!.scoped, b.lo, b.hi))
          }} />
        {update && (
          <BandEditor
            edges={edges}
            onCommit={(e) => update({ distanceEdges: e })}
            onReset={() => update({ distanceEdges: [...DEFAULT_DISTANCE_EDGES] })}
          />
        )}
      </CardFrame>
    )
  },
}
