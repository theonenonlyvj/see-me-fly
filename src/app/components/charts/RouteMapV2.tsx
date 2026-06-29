import type React from 'react'
import { useMemo, useRef, useState } from 'react'
import { geoNaturalEarth1, geoPath, geoInterpolate } from 'd3-geo'
import { feature } from 'topojson-client'
import type { Topology, Objects } from 'topojson-specification'
import type { FeatureCollection, Feature, Geometry } from 'geojson'
import countries110m from 'world-atlas/countries-110m.json'
import type { EnrichedFlight } from '../../../engine'
import { airportKey } from '../../../engine/normalize'

type WorldTopology = Topology<Objects<Record<string, unknown>>>
const topo = countries110m as unknown as WorldTopology
const landCollection = feature(topo, topo.objects.land) as FeatureCollection<Geometry>
const countriesCollection = feature(topo, topo.objects.countries) as FeatureCollection<Geometry>
const WIDTH = 980
const HEIGHT = 500
const projection = geoNaturalEarth1().fitSize([WIDTH, HEIGHT], landCollection)
const path = geoPath(projection)

function arcPath(fromLon: number, fromLat: number, toLon: number, toLat: number): string | null {
  const it = geoInterpolate([fromLon, fromLat], [toLon, toLat])
  const coords: [number, number][] = []
  for (let i = 0; i <= 50; i++) coords.push(it(i / 50))
  return path({ type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: null } as GeoJSON.Feature<GeoJSON.LineString>)
}

/**
 * Improved route map: great-circle arcs only (no heat/choropleth). Arc opacity/width are LOG-scaled
 * so a 2-airline Texas hub doesn't burn out the canvas; airport dots are sqrt-sized by visit count;
 * the home airport gets a ringed anchor. Arcs and dots are clickable (drill into the flight list).
 */
export function RouteMapV2({ flights, accent, groupAirports = false, homeKey, onRoute, onNode, nameOf }: {
  flights: EnrichedFlight[]
  accent: string
  groupAirports?: boolean
  homeKey?: string | null
  onRoute?: (aKey: string, bKey: string, label: string) => void
  onNode?: (key: string, label: string) => void
  nameOf?: (key: string) => string
}) {
  const { arcs, dots, maxRoute, maxNode } = useMemo(() => {
    const nodeAcc = new Map<string, { latSum: number; lonSum: number; n: number; count: number }>()
    const routeMap = new Map<string, { a: string; b: string; count: number }>()
    const keyOf = (code: string) => (groupAirports ? airportKey(code, true) : code)
    const acc = (key: string, lat: number, lon: number) => {
      const e = nodeAcc.get(key)
      if (e) { e.latSum += lat; e.lonSum += lon; e.n += 1; e.count += 1 }
      else nodeAcc.set(key, { latSum: lat, lonSum: lon, n: 1, count: 1 })
    }
    for (const f of flights) {
      if (!f.resolved || !f.from || !f.to || f.isLocalFlight) continue
      const fk = keyOf(f.fromCode), tk = keyOf(f.toCode)
      acc(fk, f.from.lat, f.from.lon)
      acc(tk, f.to.lat, f.to.lon)
      if (fk !== tk) {
        const rk = fk < tk ? `${fk}|${tk}` : `${tk}|${fk}`
        const r = routeMap.get(rk)
        if (r) r.count += 1
        else routeMap.set(rk, { a: fk, b: tk, count: 1 })
      }
    }
    const coordOf = (key: string): [number, number] | null => {
      const e = nodeAcc.get(key)
      return e ? [e.lonSum / e.n, e.latSum / e.n] : null
    }
    const maxRoute = Math.max(...Array.from(routeMap.values()).map((r) => r.count), 1)
    const logR = Math.log(maxRoute + 1)
    const arcs: { d: string; sw: number; op: number; a: string; b: string; count: number }[] = []
    for (const r of routeMap.values()) {
      const a = coordOf(r.a), b = coordOf(r.b)
      if (!a || !b) continue
      const d = arcPath(a[0], a[1], b[0], b[1]); if (!d) continue
      const t = Math.log(r.count + 1) / logR // log scale so the hub doesn't blow out
      arcs.push({ d, sw: 0.5 + t * 2.6, op: 0.18 + t * 0.62, a: r.a, b: r.b, count: r.count })
    }
    arcs.sort((x, y) => x.count - y.count) // faint arcs first, busy on top
    const maxNode = Math.max(...Array.from(nodeAcc.values()).map((e) => e.count), 1)
    const dots: { cx: number; cy: number; r: number; key: string; count: number; home: boolean }[] = []
    for (const [key, e] of nodeAcc) {
      const c = coordOf(key); if (!c) continue
      const p = projection(c); if (!p) continue
      const r = 1.8 + 5.2 * Math.sqrt(e.count / maxNode) // sqrt area-ish scaling
      dots.push({ cx: p[0], cy: p[1], r, key, count: e.count, home: homeKey != null && key === homeKey })
    }
    dots.sort((x, y) => x.count - y.count)
    return { arcs, dots, maxRoute, maxNode }
  }, [flights, groupAirports, homeKey])

  const label = (key: string) => (nameOf ? nameOf(key) : key)

  // ── pan / zoom (drag to pan, wheel to zoom toward the cursor) ──
  const [view, setView] = useState({ k: 1, x: 0, y: 0 })
  const svgRef = useRef<SVGSVGElement | null>(null)
  const drag = useRef<{ sx: number; sy: number; vx: number; vy: number; moved: boolean } | null>(null)
  const clamp = (k: number, x: number, y: number) => ({ k, x: Math.min(0, Math.max(WIDTH * (1 - k), x)), y: Math.min(0, Math.max(HEIGHT * (1 - k), y)) })
  const toSvg = (clientX: number, clientY: number) => {
    const r = svgRef.current!.getBoundingClientRect()
    return { x: ((clientX - r.left) / r.width) * WIDTH, y: ((clientY - r.top) / r.height) * HEIGHT }
  }
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const p = toSvg(e.clientX, e.clientY)
    setView((v) => {
      const k = Math.min(8, Math.max(1, v.k * (e.deltaY < 0 ? 1.18 : 1 / 1.18)))
      if (k === v.k) return v
      return clamp(k, p.x - ((p.x - v.x) / v.k) * k, p.y - ((p.y - v.y) / v.k) * k)
    })
  }
  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y, moved: false }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return
    const r = svgRef.current!.getBoundingClientRect()
    const dx = ((e.clientX - drag.current.sx) / r.width) * WIDTH
    const dy = ((e.clientY - drag.current.sy) / r.height) * HEIGHT
    if (Math.abs(dx) + Math.abs(dy) > 2) drag.current.moved = true
    setView((v) => clamp(v.k, drag.current!.vx + dx, drag.current!.vy + dy))
  }
  const onPointerUp = () => { drag.current = null }
  const dragged = () => drag.current?.moved // suppress click that ended a pan
  const zoomed = view.k > 1
  const baseR = (dot: typeof dots[number]) => (dot.home ? Math.max(dot.r, 5) : dot.r)

  return (
    <div style={{ position: 'relative' }}>
      <svg ref={svgRef} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        style={{ width: '100%', height: 'auto', display: 'block', cursor: zoomed ? 'grab' : 'default', touchAction: 'none' }}
        onWheel={onWheel} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp}>
        <rect width={WIDTH} height={HEIGHT} fill="#eef2f7" rx={4} />
        <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
        {countriesCollection.features.map((feat: Feature<Geometry>, i: number) => {
          const d = path(feat); if (!d) return null
          return <path key={i} data-country d={d} fill="#dce5ee" stroke="#b8c5d4" strokeWidth={0.4} vectorEffect="non-scaling-stroke" />
        })}
        {arcs.map((arc, i) => (
          <path key={i} data-arc d={arc.d} fill="none" stroke={accent} strokeWidth={arc.sw} strokeOpacity={arc.op} strokeLinecap="round" vectorEffect="non-scaling-stroke"
            style={{ cursor: onRoute ? 'pointer' : 'default' }}
            onClick={onRoute ? () => { if (!dragged()) onRoute(arc.a, arc.b, `${label(arc.a)} ↔ ${label(arc.b)}`) } : undefined}>
            <title>{`${label(arc.a)} ↔ ${label(arc.b)} — ${arc.count} flights`}</title>
          </path>
        ))}
        {dots.map((dot, i) => (
          <circle key={i} cx={dot.cx} cy={dot.cy} r={baseR(dot) / view.k}
            fill={dot.home ? '#fff' : accent} opacity={dot.home ? 1 : 0.88}
            stroke={dot.home ? accent : '#fff'} strokeWidth={(dot.home ? 2.5 : 0.7) / view.k}
            style={{ cursor: onNode ? 'pointer' : 'default' }}
            onClick={onNode ? () => { if (!dragged()) onNode(dot.key, label(dot.key)) } : undefined}>
            <title>{`${label(dot.key)} — ${dot.count} visits${dot.home ? ' (home)' : ''}`}</title>
          </circle>
        ))}
        </g>
      </svg>
      {zoomed && (
        <button onClick={() => setView({ k: 1, x: 0, y: 0 })}
          style={{ position: 'absolute', top: 8, right: 8, fontSize: 11, fontWeight: 800, color: 'var(--ink)', background: 'rgba(255,255,255,0.92)', border: '1px solid var(--hair)', borderRadius: 8, padding: '4px 9px', cursor: 'pointer' }}>
          Reset ⟲
        </button>
      )}
      {/* arc-width legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 8, fontSize: 11, color: 'var(--ink-2)', flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><svg width="34" height="8"><line x1="0" y1="4" x2="34" y2="4" stroke={accent} strokeWidth={0.6} strokeOpacity={0.5} /></svg>1 flight</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><svg width="34" height="8"><line x1="0" y1="4" x2="34" y2="4" stroke={accent} strokeWidth={3.1} strokeOpacity={0.8} /></svg>{maxRoute}× (busiest)</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><svg width="16" height="16"><circle cx="8" cy="8" r="6.5" fill={accent} opacity={0.85} /></svg>dot size = visits (up to {maxNode})</span>
      </div>
    </div>
  )
}
