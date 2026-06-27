import { useMemo } from 'react'
import { geoNaturalEarth1, geoPath, geoInterpolate } from 'd3-geo'
import { feature } from 'topojson-client'
import type { Topology, Objects } from 'topojson-specification'
import type { FeatureCollection, Feature, Geometry } from 'geojson'
import countries110m from 'world-atlas/countries-110m.json'
import type { EnrichedFlight } from '../../../engine'

// world-atlas countries-110m topology
type WorldTopology = Topology<Objects<Record<string, unknown>>>

const topo = countries110m as unknown as WorldTopology
const landCollection = feature(topo, topo.objects.land) as FeatureCollection<Geometry>
const countriesCollection = feature(topo, topo.objects.countries) as FeatureCollection<Geometry>

const WIDTH = 980
const HEIGHT = 500

const projection = geoNaturalEarth1().fitSize([WIDTH, HEIGHT], landCollection)
const pathGen = geoPath(projection)

interface RouteKey { fromLat: number; fromLon: number; toLat: number; toLon: number }

function routeKey(k: RouteKey): string {
  const a = `${k.fromLat},${k.fromLon}`
  const b = `${k.toLat},${k.toLon}`
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

function buildArcPath(fromLon: number, fromLat: number, toLon: number, toLat: number): string | null {
  const interpolator = geoInterpolate([fromLon, fromLat], [toLon, toLat])
  const N = 50
  const coords: [number, number][] = []
  for (let i = 0; i <= N; i++) coords.push(interpolator(i / N))
  const geojsonLine: GeoJSON.Feature<GeoJSON.LineString> = {
    type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: null,
  }
  return pathGen(geojsonLine)
}

/** warm low→high ramp for the heat bubbles */
function heatColor(t: number): string {
  return t > 0.6 ? '#dc2626' : t > 0.3 ? '#f97316' : '#fbbf24'
}

export function WorldMap({ flights, accent, mode = 'routes' }: { flights: EnrichedFlight[]; accent: string; mode?: 'routes' | 'heat' }) {
  const { arcs, dots, heatDots } = useMemo(() => {
    const routeMap = new Map<string, { fromLon: number; fromLat: number; toLon: number; toLat: number; count: number }>()
    const airportSet = new Map<string, { lat: number; lon: number }>()
    const airportCount = new Map<string, number>()

    for (const f of flights) {
      if (!f.resolved || !f.from || !f.to || f.isLocalFlight) continue
      const key = routeKey({ fromLat: f.from.lat, fromLon: f.from.lon, toLat: f.to.lat, toLon: f.to.lon })
      const existing = routeMap.get(key)
      if (existing) existing.count++
      else routeMap.set(key, { fromLon: f.from.lon, fromLat: f.from.lat, toLon: f.to.lon, toLat: f.to.lat, count: 1 })

      const fromKey = `${f.from.lat},${f.from.lon}`
      if (!airportSet.has(fromKey)) airportSet.set(fromKey, { lat: f.from.lat, lon: f.from.lon })
      airportCount.set(fromKey, (airportCount.get(fromKey) ?? 0) + 1)
      const toKey = `${f.to.lat},${f.to.lon}`
      if (!airportSet.has(toKey)) airportSet.set(toKey, { lat: f.to.lat, lon: f.to.lon })
      airportCount.set(toKey, (airportCount.get(toKey) ?? 0) + 1)
    }

    const maxRoute = Math.max(...Array.from(routeMap.values()).map((r) => r.count), 1)
    const arcs: { d: string; strokeWidth: number; opacity: number }[] = []
    for (const [, route] of routeMap) {
      const d = buildArcPath(route.fromLon, route.fromLat, route.toLon, route.toLat)
      if (!d) continue
      const t = route.count / maxRoute
      arcs.push({ d, strokeWidth: 0.8 + t * 2.2, opacity: 0.45 + t * 0.55 })
    }

    const dots: { cx: number; cy: number }[] = []
    for (const [, ap] of airportSet) {
      const p = projection([ap.lon, ap.lat])
      if (p) dots.push({ cx: p[0], cy: p[1] })
    }

    const maxAirport = Math.max(...Array.from(airportCount.values()), 1)
    const heatDots: { cx: number; cy: number; r: number; t: number }[] = []
    for (const [key, ap] of airportSet) {
      const p = projection([ap.lon, ap.lat])
      if (!p) continue
      const count = airportCount.get(key) ?? 1
      const t = count / maxAirport
      heatDots.push({ cx: p[0], cy: p[1], r: 3 + Math.sqrt(count) * 2.4, t })
    }
    // draw biggest last (on top)
    heatDots.sort((a, b) => a.r - b.r)

    return { arcs, dots, heatDots }
  }, [flights])

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
            <circle cx={h.cx} cy={h.cy} r={h.r * 2.1} fill="#f97316" opacity={0.10 + 0.16 * h.t} />
            <circle cx={h.cx} cy={h.cy} r={h.r} fill={heatColor(h.t)} opacity={0.78} stroke="#fff" strokeWidth={0.5} />
          </g>
        ))
      )}
    </svg>
  )
}
