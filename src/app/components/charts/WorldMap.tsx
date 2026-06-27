import { useMemo } from 'react'
import { geoNaturalEarth1, geoPath, geoInterpolate, type GeoProjection } from 'd3-geo'
import { feature } from 'topojson-client'
import type { Topology, Objects } from 'topojson-specification'
import type { FeatureCollection, Feature, Geometry } from 'geojson'
import countries110m from 'world-atlas/countries-110m.json'
import isoNumeric from '../../../reference/iso-numeric.json'
import type { EnrichedFlight } from '../../../engine'
import { airportKey } from '../../../engine/normalize'

type WorldTopology = Topology<Objects<Record<string, unknown>>>

const topo = countries110m as unknown as WorldTopology
const landCollection = feature(topo, topo.objects.land) as FeatureCollection<Geometry>
const countriesCollection = feature(topo, topo.objects.countries) as FeatureCollection<Geometry>

const WIDTH = 980
const HEIGHT = 500
// default whole-world projection (shared); `fit` mode builds a per-instance fitted one
const worldProjection = geoNaturalEarth1().fitSize([WIDTH, HEIGHT], landCollection)

const numericToAlpha2 = new Map<string, string>()
for (const [a2, num] of Object.entries(isoNumeric as Record<string, string>)) numericToAlpha2.set(String(num), a2)

export type MapMode = 'routes' | 'density' | 'choropleth'

function buildArcPath(path: ReturnType<typeof geoPath>, fromLon: number, fromLat: number, toLon: number, toLat: number): string | null {
  const it = geoInterpolate([fromLon, fromLat], [toLon, toLat])
  const coords: [number, number][] = []
  for (let i = 0; i <= 50; i++) coords.push(it(i / 50))
  return path({ type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: null } as GeoJSON.Feature<GeoJSON.LineString>)
}

function choroplethFill(t: number): string {
  if (t <= 0) return '#dce5ee'
  if (t < 0.34) return '#fde9a9'
  if (t < 0.67) return '#f6a13c'
  return '#c2381b'
}

export function WorldMap({ flights, accent, mode = 'routes', groupAirports = false, fit = false }: {
  flights: EnrichedFlight[]
  accent: string
  mode?: MapMode
  groupAirports?: boolean
  /** zoom the projection to fit just these flights (for subset mini-maps) */
  fit?: boolean
}) {
  const { path, arcs, dots, heat, countryT } = useMemo(() => {
    const nodeAcc = new Map<string, { latSum: number; lonSum: number; n: number; count: number }>()
    const routeMap = new Map<string, { a: string; b: string; count: number }>()
    const countryCount = new Map<string, number>()

    const keyOf = (code: string) => (groupAirports ? airportKey(code, true) : code)
    const acc = (key: string, lat: number, lon: number) => {
      const e = nodeAcc.get(key)
      if (e) { e.latSum += lat; e.lonSum += lon; e.n += 1; e.count += 1 }
      else nodeAcc.set(key, { latSum: lat, lonSum: lon, n: 1, count: 1 })
    }

    for (const f of flights) {
      if (!f.resolved || !f.from || !f.to) continue
      const cs = new Set<string>([f.from.country])
      if (!f.isLocalFlight) cs.add(f.to.country)
      for (const c of cs) countryCount.set(c, (countryCount.get(c) ?? 0) + 1)
      if (f.isLocalFlight) continue
      const fk = keyOf(f.fromCode); const tk = keyOf(f.toCode)
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

    // pick projection: fitted to the subset's points (with padding) when `fit`, else the world view
    let proj: GeoProjection = worldProjection
    const pts = Array.from(nodeAcc.keys()).map(coordOf).filter(Boolean) as [number, number][]
    if (fit && pts.length > 0) {
      const pad = 30
      proj = geoNaturalEarth1().fitExtent([[pad, pad], [WIDTH - pad, HEIGHT - pad]], { type: 'MultiPoint', coordinates: pts })
    }
    const path = geoPath(proj)

    const maxRoute = Math.max(...Array.from(routeMap.values()).map((r) => r.count), 1)
    const arcs: { d: string; strokeWidth: number; opacity: number }[] = []
    for (const r of routeMap.values()) {
      const a = coordOf(r.a); const b = coordOf(r.b)
      if (!a || !b) continue
      const d = buildArcPath(path, a[0], a[1], b[0], b[1]); if (!d) continue
      const t = r.count / maxRoute
      arcs.push({ d, strokeWidth: 0.8 + t * 2.2, opacity: 0.45 + t * 0.55 })
    }

    const dots: { cx: number; cy: number }[] = []
    const heat: { cx: number; cy: number; op: number; r: number }[] = []
    const maxNode = Math.max(...Array.from(nodeAcc.values()).map((e) => e.count), 1)
    const logMax = Math.log(maxNode + 1)
    for (const [key, e] of nodeAcc) {
      const c = coordOf(key); if (!c) continue
      const p = proj(c); if (!p) continue
      dots.push({ cx: p[0], cy: p[1] })
      const t = logMax > 0 ? Math.log(e.count + 1) / logMax : 0
      heat.push({ cx: p[0], cy: p[1], op: 0.35 + 0.5 * t, r: 16 + t * 14 })
    }

    const maxC = Math.max(...Array.from(countryCount.values()), 1)
    const logMaxC = Math.log(maxC + 1)
    const countryT = new Map<string, number>()
    for (const [c, n] of countryCount) countryT.set(c, logMaxC > 0 ? Math.log(n + 1) / logMaxC : 0)

    return { path, arcs, dots, heat, countryT }
  }, [flights, groupAirports, fit])

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <defs>
        <radialGradient id="heatGrad">
          <stop offset="0%" stopColor="#fff" stopOpacity="1" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <filter id="heatFilter" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="7" />
          <feComponentTransfer>
            <feFuncR type="table" tableValues="0 0 0.35 0.95 1 1 1" />
            <feFuncG type="table" tableValues="0 0.3 0.65 0.85 0.6 0.25 0" />
            <feFuncB type="table" tableValues="0.6 0.85 0.5 0.15 0 0 0" />
            <feFuncA type="table" tableValues="0 0.5 0.72 0.85 0.92 0.97 1" />
          </feComponentTransfer>
        </filter>
      </defs>

      <rect width={WIDTH} height={HEIGHT} fill="#eef2f7" rx={4} />

      {countriesCollection.features.map((feat: Feature<Geometry>, i: number) => {
        const d = path(feat); if (!d) return null
        let fill = '#dce5ee'
        if (mode === 'choropleth') {
          const a2 = numericToAlpha2.get(String(feat.id))
          fill = choroplethFill(a2 ? (countryT.get(a2) ?? 0) : 0)
        }
        return <path key={i} data-country d={d} fill={fill} stroke="#b8c5d4" strokeWidth={0.4} />
      })}

      {mode === 'routes' && (
        <>
          {arcs.map((arc, i) => (
            <path key={i} data-arc d={arc.d} fill="none" stroke={accent} strokeWidth={arc.strokeWidth} strokeOpacity={arc.opacity} strokeLinecap="round" />
          ))}
          {dots.map((dot, i) => (
            <circle key={i} cx={dot.cx} cy={dot.cy} r={3} fill={accent} opacity={0.85} stroke="#fff" strokeWidth={0.8} />
          ))}
        </>
      )}

      {mode === 'density' && (
        <g data-heat filter="url(#heatFilter)">
          {heat.map((h, i) => (
            <circle key={i} cx={h.cx} cy={h.cy} r={h.r} fill="url(#heatGrad)" opacity={h.op} />
          ))}
        </g>
      )}
    </svg>
  )
}
