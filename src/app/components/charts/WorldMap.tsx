import { useMemo } from 'react'
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
const pathGen = geoPath(projection)

function buildArcPath(fromLon: number, fromLat: number, toLon: number, toLat: number): string | null {
  const interpolator = geoInterpolate([fromLon, fromLat], [toLon, toLat])
  const N = 50
  const coords: [number, number][] = []
  for (let i = 0; i <= N; i++) coords.push(interpolator(i / N))
  const line: GeoJSON.Feature<GeoJSON.LineString> = { type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: null }
  return pathGen(line)
}

/** warm low→high ramp for the heat bubbles */
function heatColor(t: number): string {
  return t > 0.6 ? '#dc2626' : t > 0.3 ? '#f97316' : '#fbbf24'
}

export function WorldMap({ flights, accent, mode = 'routes', groupAirports = false }: {
  flights: EnrichedFlight[]
  accent: string
  mode?: 'routes' | 'heat'
  /** collapse nearby airports into one metro node (Dallas = DFW+DAL) for both routes and heat */
  groupAirports?: boolean
}) {
  const { arcs, dots, heatDots } = useMemo(() => {
    // Aggregate by NODE (a metro group when grouping, else a single airport). Each node's point is
    // the centroid of the member-airport coordinates actually seen, so a metro plots as one bubble.
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
      const fk = keyOf(f.fromCode)
      const tk = keyOf(f.toCode)
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
    const arcs: { d: string; strokeWidth: number; opacity: number }[] = []
    for (const r of routeMap.values()) {
      const a = coordOf(r.a); const b = coordOf(r.b)
      if (!a || !b) continue
      const d = buildArcPath(a[0], a[1], b[0], b[1])
      if (!d) continue
      const t = r.count / maxRoute
      arcs.push({ d, strokeWidth: 0.8 + t * 2.2, opacity: 0.45 + t * 0.55 })
    }

    const dots: { cx: number; cy: number }[] = []
    for (const key of nodeAcc.keys()) {
      const c = coordOf(key); if (!c) continue
      const p = projection(c); if (p) dots.push({ cx: p[0], cy: p[1] })
    }

    const maxNode = Math.max(...Array.from(nodeAcc.values()).map((e) => e.count), 1)
    const logMax = Math.log(maxNode + 1)
    const heatDots: { cx: number; cy: number; r: number; t: number }[] = []
    for (const [key, e] of nodeAcc) {
      const c = coordOf(key); if (!c) continue
      const p = projection(c); if (!p) continue
      const t = logMax > 0 ? Math.log(e.count + 1) / logMax : 0
      heatDots.push({ cx: p[0], cy: p[1], r: 3.5 + t * 9, t })
    }
    heatDots.sort((a, b) => a.r - b.r)

    return { arcs, dots, heatDots }
  }, [flights, groupAirports])

  const countryFeatures = countriesCollection.features

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <rect width={WIDTH} height={HEIGHT} fill="#eef2f7" rx={4} />

      {countryFeatures.map((feat: Feature<Geometry>, i: number) => {
        const d = pathGen(feat)
        if (!d) return null
        return <path key={i} data-country d={d} fill="#dce5ee" stroke="#b8c5d4" strokeWidth={0.4} />
      })}

      {mode === 'routes' ? (
        <>
          {arcs.map((arc, i) => (
            <path key={i} data-arc d={arc.d} fill="none" stroke={accent} strokeWidth={arc.strokeWidth} strokeOpacity={arc.opacity} strokeLinecap="round" />
          ))}
          {dots.map((dot, i) => (
            <circle key={i} cx={dot.cx} cy={dot.cy} r={3} fill={accent} opacity={0.85} stroke="#fff" strokeWidth={0.8} />
          ))}
        </>
      ) : (
        heatDots.map((h, i) => (
          <g key={i}>
            <circle cx={h.cx} cy={h.cy} r={h.r + 4} fill={heatColor(h.t)} opacity={0.16} />
            <circle cx={h.cx} cy={h.cy} r={h.r} fill={heatColor(h.t)} opacity={0.62} stroke="#fff" strokeWidth={0.5} />
          </g>
        ))
      )}
    </svg>
  )
}
