import { useState } from 'react'
import CardFrame from '../components/CardFrame'
import { RouteMapV2 } from '../components/charts/RouteMapV2'
import { homeKeys } from '../../engine/home'
import { displayEndpoint } from '../lib/places'
import { flightsByRoutePair, flightsByAirportKey } from '../lib/flight-filters'
import type { CardContext, CardDef } from './registry'

const ACCENT = 'var(--accent-4)'
const ACCENT_GRAD = 'linear-gradient(90deg, var(--accent-4), color-mix(in srgb, var(--accent-4) 60%, white))'
const ACCENT_SOFT = 'color-mix(in srgb, var(--accent-4) 10%, white)'

function MapV2View({ model, settings, overlay }: CardContext) {
  const [mode, setMode] = useState<'routes' | 'districts'>('routes')
  // Date-less anchor: ring every home in the union (`homeKeys().keys`), emphasizing the
  // current/most-recent home (`primaryKey`). Covers the legacy single `home` too.
  const { keys: homeKeySet, primaryKey } = homeKeys(settings)
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
