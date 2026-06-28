import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { CARDS } from '../cards/registry'
import type { CardContext, CardDef } from '../cards/registry'
import type { Model } from '../state/useModel'
import type { Settings } from '../../engine'
import { useOverlay } from './Overlay'

const GAP = 24

// The storyline: section title -> ordered card ids. The full-width map is the hero of section 1.
const SECTIONS: { title: string; ids: string[] }[] = [
  { title: 'The big picture', ids: ['overview', 'odometer'] },
  { title: 'Your story over time', ids: ['careerArc', 'airlineEras'] },
  { title: "Where you've been", ids: ['countries', 'airports', 'geoExtremes', 'howFarFromHome'] },
  { title: 'How far you go', ids: ['distance', 'shortest', 'longest'] },
  { title: 'Your routes', ids: ['routes', 'layovers', 'domesticState', 'domesticCountry', 'domesticContinent', 'intercontinental'] },
  { title: 'How you fly', ids: ['airlines', 'aircraft', 'aircraftClass', 'aircraftClassBar', 'sameMetal', 'delays'] },
  { title: 'When you fly', ids: ['whenYouFly', 'dayOfWeek', 'intensity', 'records'] },
]

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

/** Absolute-positioned greedy masonry over a fixed set of cards (cards never remount on reflow). */
function Masonry({ cards, cols, ctx }: { cards: CardDef[]; cols: number; ctx: CardContext }) {
  const ids = useMemo(() => cards.map((c) => c.id), [cards])

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
      let min = 0
      for (let c = 1; c < cols; c++) if (colH[c] < colH[min]) min = c
      pos[id] = { left: min * (colWidth + GAP), top: colH[min] }
      colH[min] += (heights.current[id] ?? 0) + GAP
    }
    setLayout({ pos, height: Math.max(0, ...colH) })
  }, [ids, cols, colWidth, ready])

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
              ? { position: 'absolute', left: p.left, top: p.top, width: colWidth, transition: 'top .25s ease, left .25s ease' }
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
  const mapCard = byId['map']

  // Any registered card not placed in a section falls into a trailing "More" section (defensive).
  const placed = new Set<string>(['map', ...SECTIONS.flatMap((s) => s.ids)])
  const leftovers = CARDS.filter((c) => !placed.has(c.id))
  const sections = leftovers.length ? [...SECTIONS, { title: 'More', ids: leftovers.map((c) => c.id) }] : SECTIONS

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '14px 28px 80px' }}>
      {sections.map((section) => {
        const cards = section.ids.map((id) => byId[id]).filter(Boolean) as CardDef[]
        const isBigPicture = section.title === 'The big picture'
        return (
          <section key={section.title} style={{ marginBottom: 40 }}>
            <SectionHeader title={section.title} />
            {isBigPicture && mapCard && <div style={{ marginBottom: GAP }}>{mapCard.render(ctx)}</div>}
            <Masonry cards={cards} cols={cols} ctx={ctx} />
          </section>
        )
      })}
    </div>
  )
}
