import { useLayoutEffect, useMemo, useRef, useState, useEffect } from 'react'
import { CARDS } from '../cards/registry'
import type { Model } from '../state/useModel'
import type { Settings } from '../../engine'
import { useOverlay } from './Overlay'

/** Responsive column count (3 / 2 / 1). */
function useColumns(): number {
  const get = () => {
    const w = typeof window !== 'undefined' ? window.innerWidth : 1280
    return w <= 640 ? 1 : w <= 980 ? 2 : 3
  }
  const [cols, setCols] = useState(get)
  useEffect(() => {
    const onResize = () => setCols(get())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return cols
}

/** Distribute ids round-robin (used before heights are known). */
function roundRobin(ids: string[], cols: number): string[][] {
  const out: string[][] = Array.from({ length: cols }, () => [])
  ids.forEach((id, i) => out[i % cols].push(id))
  return out
}

/** Height-aware greedy: place each card (in order) into the currently shortest column. */
function greedy(ids: string[], cols: number, heights: Record<string, number>): string[][] {
  const out: string[][] = Array.from({ length: cols }, () => [])
  const totals = new Array(cols).fill(0)
  for (const id of ids) {
    let min = 0
    for (let c = 1; c < cols; c++) if (totals[c] < totals[min]) min = c
    out[min].push(id)
    totals[min] += (heights[id] ?? 0) + 24 // +gap
  }
  return out
}

export default function CardGrid({ model, settings }: { model: Model; settings: Settings }) {
  const overlay = useOverlay()
  const cols = useColumns()

  const map = useMemo(() => CARDS.find((c) => c.id === 'map'), [])
  const rest = useMemo(() => CARDS.filter((c) => c.id !== 'map'), [])
  const byId = useMemo(() => Object.fromEntries(CARDS.map((c) => [c.id, c])), [])
  const ids = useMemo(() => rest.map((c) => c.id), [rest])

  const wrapRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [columns, setColumns] = useState<string[][]>(() => roundRobin(ids, cols))

  // Recompute the greedy packing only when the column count changes (viewport) — NOT when a
  // card grows from an internal "Show all". Expansion just lengthens that card's frozen column.
  useLayoutEffect(() => {
    const heights: Record<string, number> = {}
    for (const id of ids) heights[id] = wrapRefs.current[id]?.offsetHeight ?? 0
    setColumns(greedy(ids, cols, heights))
  }, [cols, ids])

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '14px 28px 80px' }}>
      {map && <div style={{ marginBottom: 24 }}>{map.render({ model, settings, overlay })}</div>}
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        {columns.map((colIds, ci) => (
          <div key={ci} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 24 }}>
            {colIds.map((id) => {
              const c = byId[id]
              if (!c) return null
              return (
                <div key={id} ref={(el) => { wrapRefs.current[id] = el }}>
                  {c.render({ model, settings, overlay })}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
