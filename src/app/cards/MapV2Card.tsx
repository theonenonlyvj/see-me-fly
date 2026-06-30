import { useState } from 'react'
import CardFrame from '../components/CardFrame'
import { RouteMapV2 } from '../components/charts/RouteMapV2'
import { homePrimaryKeys, homeAt } from '../../engine/home'
import { airportKey } from '../../engine/normalize'
import { displayEndpoint } from '../lib/places'
import { flightsByRoutePair, flightsByAirportKey } from '../lib/flight-filters'
import type { Settings } from '../../engine'
import type { CardContext, CardDef } from './registry'

/**
 * The home key to EMPHASIZE on the map's primary dot (SHOULD-FIX 5). For an all-time view it's the
 * most-recent home (`homePrimaryKeys().currentKey`). When the view is scoped to a single year,
 * emphasize THAT year's home instead — `homeAt('<year>-07-01')?.primary`, key-normalized — so
 * scoping to 2019 highlights the 2019-era home (DEN) rather than today's DFW. Only PRIMARY metros
 * are ringed (co-home secondaries like SEA/PAE are membership-only); this picks which primary is
 * emphasized. Falls back to the all-time primary if a scoped year can't resolve a home (e.g. no
 * timeline) so the legacy single `home` still emphasizes.
 */
export function emphasizedPrimaryKey(settings: Settings, scopeYear: number | null): string | null {
  const allTime = homePrimaryKeys(settings).currentKey
  if (scopeYear == null) return allTime
  // Mid-year probe date — avoids a boundary era flipping a Jan-1 / Dec-31 move.
  const scoped = homeAt(`${scopeYear}-07-01`, settings)?.primary
  return scoped ? airportKey(scoped, settings.groupAirports) : allTime
}

const ACCENT = 'var(--accent-4)'
const ACCENT_GRAD = 'linear-gradient(90deg, var(--accent-4), color-mix(in srgb, var(--accent-4) 60%, white))'
const ACCENT_SOFT = 'color-mix(in srgb, var(--accent-4) 10%, white)'

function MapV2View({ model, settings, overlay }: CardContext) {
  const [mode, setMode] = useState<'routes' | 'districts'>('routes')
  // Ring ONLY the displayed home BASES — the distinct PRIMARY metros (`homePrimaryKeys().keys`),
  // covering the legacy single `home` too. Co-home secondaries (e.g. SEA/PAE under a Denver era)
  // are membership-only and must NOT light up as their own base. Then emphasize the home of the
  // ACTIVE year-scope (SHOULD-FIX 5): under a 2019 scope the 2019-era primary is highlighted, not
  // today's. All-time falls back to the most-recent primary.
  const { keys: homeKeySet } = homePrimaryKeys(settings)
  const primaryKey = emphasizedPrimaryKey(settings, model!.scopeYear)
  return (
    <CardFrame title="Your map ✦" eyebrow="Routes, hubs & home — tap to drill in" accent={ACCENT} accentGrad={ACCENT_GRAD} accentSoft={ACCENT_SOFT} icon="🗺️" fullWidth>
      <div style={{ display: 'inline-flex', padding: 3, gap: 2, marginBottom: 12, background: ACCENT_SOFT, borderRadius: 12, border: `1px solid color-mix(in srgb, ${ACCENT} 24%, transparent)` }}>
        {([['routes', 'Routes'], ['districts', 'Districts']] as ['routes' | 'districts', string][]).map(([m, lbl]) => (
          <button key={m} onClick={() => setMode(m)}
            style={{ fontFamily: 'var(--font)', fontSize: 12, fontWeight: 800, border: 'none', cursor: 'pointer', padding: '6px 13px', borderRadius: 9, color: mode === m ? '#fff' : 'var(--ink)', background: mode === m ? ACCENT : 'transparent' }}>
            {lbl}
          </button>
        ))}
      </div>
      <RouteMapV2
        flights={model!.scoped}
        accent="var(--accent-4)"
        groupAirports={settings.groupAirports}
        homeKeys={homeKeySet}
        primaryKey={primaryKey}
        mode={mode}
        nameOf={(key) => displayEndpoint(key)}
        onRoute={mode === 'routes' && overlay ? (a, b, label) => overlay.openFlights(label, flightsByRoutePair(model!.scoped, a, b, settings.groupAirports)) : undefined}
        onNode={mode === 'routes' && overlay ? (key, label) => overlay.openFlights(label, flightsByAirportKey(model!.scoped, key, settings)) : undefined}
      />
      <p style={{ marginTop: 8, fontSize: 11.5, color: 'var(--ink-2)', fontStyle: 'italic' }}>
        {mode === 'routes'
          ? 'Arc thickness & opacity = how often you fly it (log-scaled); dot size = visits; ◯ = home. Drag to pan, scroll to zoom, tap any arc or dot.'
          : 'Each airport cluster lights a fixed ~100-mile district, shaded by how often you visit — so a hub city never floods its whole country. Drag to pan, scroll to zoom.'}
      </p>
    </CardFrame>
  )
}

export const mapV2Card: CardDef = {
  id: 'mapV2',
  title: 'Your map ✦',
  group: 'creative',
  accent: ACCENT,
  icon: '🗺️',
  render: (ctx: CardContext) => <MapV2View {...ctx} />,
}
