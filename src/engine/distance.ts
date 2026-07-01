import { EARTH_RADIUS_MI } from './constants'

const rad = (d: number) => (d * Math.PI) / 180

export function haversineMi(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const dLat = rad(bLat - aLat)
  const dLon = rad(bLon - aLon)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_MI * Math.asin(Math.min(1, Math.sqrt(s)))
}

/**
 * Initial great-circle (forward-azimuth) bearing from A to B, in degrees, normalized
 * to [0, 360): 0 = due North, 90 = East, 180 = South, 270 = West — a compass reading
 * that matches `polar(cx, cy, r, angleDeg)` (0° = up/North, clockwise). This is the
 * bearing at the START of the great-circle path, so it can differ from the straight
 * rhumb-line heading over long distances (correct for a "which way did I fly out" plot).
 * Coincident points return 0 (an arbitrary, stable choice — there is no defined bearing).
 */
export function bearingDeg(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const φ1 = rad(aLat)
  const φ2 = rad(bLat)
  const Δλ = rad(bLon - aLon)
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  const θ = Math.atan2(y, x) // −π..π, 0 = North, +East
  return ((θ * 180) / Math.PI + 360) % 360
}
