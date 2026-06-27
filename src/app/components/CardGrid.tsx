import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { CARDS } from '../cards/registry'
import type { Model } from '../state/useModel'
import type { Settings } from '../../engine'
import { useOverlay } from './Overlay'

const GAP = 24

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

interface Pos { left: number; top: number }

export default function CardGrid({ model, settings }: { model: Model; settings: Settings }) {
  const overlay = useOverlay()
  const cols = useColumns()

  const map = useMemo(() => CARDS.find((c) => c.id === 'map'), [])
  const rest = useMemo(() => CARDS.filter((c) => c.id !== 'map'), [])
  const ids = useMemo(() => rest.map((c) => c.id), [rest])

  const containerRef = useRef<HTMLDivElement | null>(null)
  const wrapRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const refSetters = useRef(new Map<string, (el: HTMLDivElement | null) => void>())
  const getSetter = (id: string) => {
    let s = refSetters.current.get(id)
    if (!s) { s = (el) => { wrapRefs.current[id] = el }; refSetters.current.set(id, s) }
    return s
  }
  const heights = useRef<Record<string, number>>({})

  const [containerW, setContainerW] = useState(0)
  const [layout, setLayout] = useState<{ pos: Record<string, Pos>; height: number }>({ pos: {}, height: 0 })

  const colWidth = cols > 0 && containerW > 0 ? (containerW - GAP * (cols - 1)) / cols : 0
  const ready = colWidth > 0

  // Greedy height-balanced packing: each card goes into the currently shortest column.
  // Cards never move in the DOM (single flat list, stable keys) — only their absolute left/top
  // change — so expanding one card reflows the others into neighboring columns WITHOUT remounting
  // them (their internal state, e.g. a BarList "Show all", is preserved).
  const relayout = useCallback(() => {
    if (!ready) { setLayout({ pos: {}, height: 0 }); return }
    const colH = new Array(cols).fill(0)
    const pos: Record<string, Pos> = {}
    for (const id of ids) {
      let min = 0
      for (let c = 1; c < cols; c++) if (colH[c] < colH[min]) min = c
      pos[id] = { left: min * (colWidth + GAP), top: colH[min] }
      colH[min] += (heights.current[id] ?? 0) + GAP
    }
    setLayout({ pos, height: Math.max(0, ...colH) })
  }, [ids, cols, colWidth, ready])

  // Track the container's available width.
  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const measure = () => setContainerW(el.clientWidth)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Track each card's height; re-pack whenever one changes (an expand/collapse).
  useLayoutEffect(() => {
    // Synchronous measure first so the initial pre-paint layout uses real heights (no flash).
    for (const id of ids) { const el = wrapRefs.current[id]; if (el) heights.current[id] = el.offsetHeight }
    relayout()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => {
      let changed = false
      for (const e of entries) {
        const el = e.target as HTMLElement
        const id = el.dataset.cardId
        if (!id) continue
        const h = el.offsetHeight
        if (heights.current[id] !== h) { heights.current[id] = h; changed = true }
      }
      if (changed) relayout()
    })
    for (const id of ids) { const el = wrapRefs.current[id]; if (el) ro.observe(el) }
    return () => ro.disconnect()
  }, [ids, relayout])

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '14px 28px 80px' }}>
      {map && <div style={{ marginBottom: GAP }}>{map.render({ model, settings, overlay })}</div>}
      <div ref={containerRef} style={{ position: 'relative', height: ready ? layout.height : undefined }}>
        {rest.map((c) => {
          const p = layout.pos[c.id]
          const positioned = ready && p
          return (
            <div
              key={c.id}
              data-card-id={c.id}
              ref={getSetter(c.id)}
              style={positioned
                ? { position: 'absolute', left: p.left, top: p.top, width: colWidth, transition: 'top .25s ease, left .25s ease' }
                : { marginBottom: GAP }}
            >
              {c.render({ model, settings, overlay })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
