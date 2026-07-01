import CardFrame from '../components/CardFrame'
import HomeAwayRibbon, { HOME_AWAY_LEGEND, HOME_AWAY_TIER_COLOR } from '../components/charts/HomeAwayRibbon'
import { reconstructTrips, homeAwayRibbon, longestHomeStretch, longestAwayStint } from '../../engine/stats'
import { hasHome } from '../../engine/home'
import type { CardContext, CardDef } from './registry'

const ACCENT = 'var(--lime)'
const ACCENT_GRAD = 'linear-gradient(90deg, #12c08a, #1aa9ff, #6a3cff, #ff2fa8)'
const ACCENT_SOFT = 'var(--lime-soft)'

function HomeAwayView({ model, settings }: CardContext) {
  // Life-portrait: reconstruct trips over ALL-TIME flights (a cross-year relocation stays one trip).
  const trips = reconstructTrips(model!.flown, settings)
  const empty = !hasHome(settings) || trips.length === 0
  const rows = empty ? [] : homeAwayRibbon(trips, settings)
  const longestHome = empty ? null : longestHomeStretch(trips)
  const longestAway = empty ? null : longestAwayStint(trips)

  return (
    <CardFrame title="Home & away" eyebrow="Presence & absence" accent={ACCENT} accentGrad={ACCENT_GRAD} accentSoft={ACCENT_SOFT} icon="🏡" poppable>
      {empty ? (
        <p style={{ color: 'var(--ink-2)', fontSize: 13 }}>
          {!hasHome(settings)
            ? 'Set your home airport in Settings to see your home-vs-away rhythm.'
            : 'No trips could be reconstructed for this view yet.'}
        </p>
      ) : (
        <>
          {/* legend: Domestic / Transatlantic / Transpacific */}
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', fontSize: 11.5, color: 'var(--ink-2)', fontWeight: 600, marginBottom: 8 }}>
            {HOME_AWAY_LEGEND.map((row) => (
              <span key={row.tier} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span aria-hidden style={{ display: 'inline-block', width: 11, height: 11, borderRadius: 3, background: HOME_AWAY_TIER_COLOR[row.tier] }} />
                {row.label}
              </span>
            ))}
          </div>
          <HomeAwayRibbon rows={rows} longestHome={longestHome} longestAway={longestAway} />
          <p style={{ marginTop: 10, fontSize: 11.5, color: 'var(--ink-2)', fontStyle: 'italic' }}>
            Each row = one year; bare warm paper = home, a colored block = a reconstructed trip (colored by its farthest reach);
            hatched = an estimated trip boundary. "% away" is real; trips are reconstructed from flights + ground links.
          </p>
        </>
      )}
    </CardFrame>
  )
}

export const homeAwayCard: CardDef = {
  id: 'homeAway',
  title: 'Home & away',
  group: 'creative',
  accent: ACCENT,
  icon: '🏡',
  render: (ctx: CardContext) => <HomeAwayView {...ctx} />,
}
