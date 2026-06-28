import CardFrame from '../components/CardFrame'
import { RouteMapV2 } from '../components/charts/RouteMapV2'
import { airportKey } from '../../engine/normalize'
import { displayEndpoint } from '../lib/places'
import { flightsByRoutePair, flightsByAirportKey } from '../lib/flight-filters'
import type { CardContext, CardDef } from './registry'

const ACCENT = 'var(--accent-4)'
const ACCENT_GRAD = 'linear-gradient(90deg, var(--accent-4), color-mix(in srgb, var(--accent-4) 60%, white))'
const ACCENT_SOFT = 'color-mix(in srgb, var(--accent-4) 10%, white)'

export const mapV2Card: CardDef = {
  id: 'mapV2',
  title: 'Your map ✦',
  group: 'creative',
  accent: ACCENT,
  icon: '🗺️',
  render: ({ model, settings, overlay }: CardContext) => {
    const homeKey = settings.home ? airportKey(settings.home, settings.groupAirports) : null
    return (
      <CardFrame title="Your map ✦" eyebrow="Routes, hubs & home — tap to drill in" accent={ACCENT} accentGrad={ACCENT_GRAD} accentSoft={ACCENT_SOFT} icon="🗺️" fullWidth>
        <RouteMapV2
          flights={model!.scoped}
          accent="var(--accent-4)"
          groupAirports={settings.groupAirports}
          homeKey={homeKey}
          nameOf={(key) => displayEndpoint(key)}
          onRoute={overlay ? (a, b, label) => overlay.openFlights(label, flightsByRoutePair(model!.scoped, a, b, settings.groupAirports)) : undefined}
          onNode={overlay ? (key, label) => overlay.openFlights(label, flightsByAirportKey(model!.scoped, key, settings)) : undefined}
        />
        <p style={{ marginTop: 8, fontSize: 11.5, color: 'var(--ink-2)', fontStyle: 'italic' }}>
          Arc thickness &amp; opacity = how often you fly it (log-scaled); dot size = visits; ◯ = home. Tap any arc or dot.
        </p>
      </CardFrame>
    )
  },
}
