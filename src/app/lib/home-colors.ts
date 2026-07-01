import { homeAt, sanitizeHomeHistory } from '../../engine/home'
import { airportKey } from '../../engine/normalize'
import { displayEndpoint } from './places'
import type { Settings } from '../../engine'

/**
 * Fixed Pop-palette order for home eras. The first distinct home metro (by first appearance
 * in the chronological `homeHistory`, falling back to the single `home`) gets coral, the next
 * indigo, and so on. Kept in ONE place so the spiral's ticks and its legend agree exactly.
 */
export const HOME_COLOR_ORDER = [
  '#ff3d57', // coral
  '#6a3cff', // indigo
  '#1aa9ff', // sky
  '#12c08a', // lime
  '#ff7a14', // tangerine
  '#ff2fa8', // magenta
] as const

/** Neutral fallback when no home is set (a single-color spiral, no swatches). */
export const NEUTRAL_HOME_COLOR = '#ff3d57' // coral

export interface HomeColoring {
  /** Color for the home era active on a given YYYY-MM-DD date. Always returns a color. */
  colorFor: (date: string) => string
  /** Legend rows (label + swatch), in the same fixed order as the ticks. Empty when no home is set. */
  legend: { label: string; color: string }[]
  /** True when at least one home is configured (timeline or single `home`). */
  hasHomes: boolean
}

/**
 * Build a stable home→color mapping from settings.
 *
 * Each distinct home METRO — keyed by `airportKey(primary, groupAirports)` so grouped/ungrouped
 * tokens for the same base collapse — is assigned the next color in `HOME_COLOR_ORDER`, in the
 * chronological order the metro FIRST appears across the sanitized `homeHistory` (or the lone
 * `home` when there's no timeline). More distinct homes than palette entries wrap (rare; 6 slots).
 *
 * When NO home is set (empty timeline AND null `home`), `colorFor` returns the neutral coral for
 * every date and `legend` is empty — the card then omits the "HOME THAT DAY" swatches.
 */
export function buildHomeColoring(settings: Settings): HomeColoring {
  const eras = sanitizeHomeHistory(settings.homeHistory)

  // Ordered distinct primaries (chronological first-appearance).
  const primaries: string[] = []
  const seen = new Set<string>()
  const push = (code: string) => {
    const key = airportKey(code, settings.groupAirports)
    if (seen.has(key)) return
    seen.add(key)
    primaries.push(code)
  }
  if (eras.length > 0) {
    for (const era of eras) push(era.airports[0])
  } else if (settings.home != null) {
    push(settings.home)
  }

  const hasHomes = primaries.length > 0

  // key → color, for O(1) date coloring.
  const colorByKey = new Map<string, string>()
  primaries.forEach((code, i) => {
    colorByKey.set(airportKey(code, settings.groupAirports), HOME_COLOR_ORDER[i % HOME_COLOR_ORDER.length])
  })

  const legend = primaries.map((code, i) => ({
    label: displayEndpoint(code),
    color: HOME_COLOR_ORDER[i % HOME_COLOR_ORDER.length],
  }))

  const colorFor = (date: string): string => {
    if (!hasHomes) return NEUTRAL_HOME_COLOR
    const home = homeAt(date, settings)
    if (!home) return NEUTRAL_HOME_COLOR
    return colorByKey.get(airportKey(home.primary, settings.groupAirports)) ?? NEUTRAL_HOME_COLOR
  }

  return { colorFor, legend, hasHomes }
}
