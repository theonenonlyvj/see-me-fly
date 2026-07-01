import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { CARDS } from '../cards/registry'
import type { CardContext, CardDef } from '../cards/registry'
import type { Model } from '../state/useModel'
import type { Settings } from '../../engine'
import { useOverlay } from './Overlay'

const GAP = 24

// The storyline: section title -> ordered card ids. Full-width cards (FULLWIDTH) render
// stacked above their section's masonry; everything else flows in the columns.
const SECTIONS: { title: string; ids: string[] }[] = [
  { title: 'The big picture', ids: ['map', 'mapV2', 'overview', 'odometer', 'personality'] },
  { title: 'Your story over time', ids: ['spiralAloft', 'allegiance', 'careerArc', 'airlineEras'] },
  { title: "Where you've been", ids: ['countries', 'airports', 'geoExtremes', 'howFarFromHome', 'rangeBloom'] },
  { title: 'How far you go', ids: ['distance', 'topRouteHero', 'shortest', 'longest'] },
  { title: 'Your routes & trips', ids: ['homeAway', 'routes', 'layovers', 'tripsExplorer', 'commuterCadence', 'nightsAway', 'domesticState', 'domesticCountry', 'domesticContinent', 'intercontinental'] },
  { title: 'How you fly', ids: ['airlines', 'alliances', 'ghostAirlines', 'aircraft', 'aircraftClass', 'aircraftClassBar', 'sameMetal', 'fleet', 'delays'] },
  { title: 'When you fly', ids: ['bodyClock', 'whenYouFly', 'whenYouFlyOverlay', 'dayOfWeek', 'redEyes', 'yearBlooms', 'intensity', 'records'] },
]

// Cards rendered full-width (stacked above the masonry) rather than in a column: just the maps.
const FULLWIDTH = new Set(['map', 'mapV2'])

// Cards that span 2 masonry columns (prominent, but not obnoxiously full-width). On a 1-column
// layout they're full width; on 2 columns they fill the row; on 3 they take two-thirds.
const SPAN2 = new Set(['spiralAloft', 'allegiance', 'homeAway'])

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

/** Absolute-positioned greedy masonry over a fixed set of cards (cards never remount on reflow).
 *  Cards in `span2` occupy two adjacent columns (capped at the column count). */
function Masonry({ cards, cols, ctx, span2 }: { cards: CardDef[]; cols: number; ctx: CardContext; span2: Set<string> }) {
  const ids = useMemo(() => cards.map((c) => c.id), [cards])
  const spanOf = (id: string) => (span2.has(id) ? Math.min(2, cols) : 1)

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

  const relayout = useCallback(() => {
    if (!ready) { setLayout({ pos: {}, height: 0 }); return }
    const colH = new Array(cols).fill(0)
    const pos: Record<string, Pos> = {}
    for (const id of ids) {
      const h = (heights.current[id] ?? 0) + GAP
      if (spanOf(id) >= 2 && cols >= 2) {
        // place across the adjacent column pair whose taller side is lowest
        let best = 0, bestTop = Infinity
        for (let i = 0; i <= cols - 2; i++) {
          const top = Math.max(colH[i], colH[i + 1])
          if (top < bestTop - 0.001) { bestTop = top; best = i }
        }
        pos[id] = { left: best * (colWidth + GAP), top: bestTop }
        colH[best] = colH[best + 1] = bestTop + h
      } else {
        let min = 0
        for (let c = 1; c < cols; c++) if (colH[c] < colH[min]) min = c
        pos[id] = { left: min * (colWidth + GAP), top: colH[min] }
        colH[min] += h
      }
    }
    setLayout({ pos, height: Math.max(0, ...colH) })
  }, [ids, cols, colWidth, ready, span2])

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

  useLayoutEffect(() => {
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
    <div ref={containerRef} style={{ position: 'relative', height: ready ? layout.height : undefined }}>
      {cards.map((c) => {
        const p = layout.pos[c.id]
        const positioned = ready && p
        return (
          <div
            key={c.id}
            data-card-id={c.id}
            ref={getSetter(c.id)}
            style={positioned
              ? { position: 'absolute', left: p.left, top: p.top, width: spanOf(c.id) >= 2 ? colWidth * 2 + GAP : colWidth, transition: 'top .25s ease, left .25s ease' }
              : { marginBottom: GAP }}
          >
            {c.render(ctx)}
          </div>
        )
      })}
    </div>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, margin: '6px 0 18px' }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, letterSpacing: '-0.01em', color: 'var(--ink)', margin: 0 }}>{title}</h2>
      <div style={{ flex: 1, height: 1, background: 'var(--hair-2)' }} />
    </div>
  )
}

export default function CardGrid({ model, settings, update }: { model: Model; settings: Settings; update?: (patch: Partial<Settings>) => void }) {
  const overlay = useOverlay()
  const cols = useColumns()
  const ctx: CardContext = { model, settings, overlay, update }

  const byId = useMemo(() => Object.fromEntries(CARDS.map((c) => [c.id, c])), [])

  // Any registered card not placed in a section falls into a trailing "More" section (defensive).
  const placed = new Set<string>(SECTIONS.flatMap((s) => s.ids))
  const leftovers = CARDS.filter((c) => !placed.has(c.id))
  const sections = leftovers.length ? [...SECTIONS, { title: 'More', ids: leftovers.map((c) => c.id) }] : SECTIONS

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '14px 28px 80px' }}>
      {sections.map((section) => {
        const cards = section.ids.map((id) => byId[id]).filter(Boolean) as CardDef[]
        const wide = cards.filter((c) => FULLWIDTH.has(c.id))   // maps render full-width, stacked
        const rest = cards.filter((c) => !FULLWIDTH.has(c.id))  // everything else flows in the masonry
        return (
          <section key={section.title} style={{ marginBottom: 40 }}>
            <SectionHeader title={section.title} />
            {wide.map((c) => <div key={c.id} style={{ marginBottom: GAP }}>{c.render(ctx)}</div>)}
            {rest.length > 0 && <Masonry cards={rest} cols={cols} ctx={ctx} span2={SPAN2} />}
          </section>
        )
      })}
    </div>
  )
}
