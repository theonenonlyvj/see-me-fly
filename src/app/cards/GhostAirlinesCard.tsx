import CardFrame from '../components/CardFrame'
import { ghostAirlines } from '../../engine/stats'
import { airlineLogos } from '../../engine/reference'
import { flightsByAirline } from '../lib/flight-filters'
import type { CardContext, CardDef } from './registry'

const ACCENT = '#8b8794'
const GRAD = 'linear-gradient(90deg, #8b8794, #b6b2bd)'
const SOFT = '#eceaef'

export const ghostAirlinesCard: CardDef = {
  id: 'ghostAirlines',
  title: 'Ghosts of airlines past',
  group: 'creative',
  accent: ACCENT,
  icon: '🪦',
  render: ({ model, overlay }: CardContext) => {
    const ghosts = ghostAirlines(model!.scoped)
    return (
      <CardFrame title="Ghosts of airlines past" eyebrow="Carriers that no longer exist" accent={ACCENT} accentGrad={GRAD} accentSoft={SOFT} icon="🪦">
        {ghosts.length === 0 ? (
          <p style={{ color: 'var(--ink-2)' }}>No defunct carriers in this view — you flew survivors.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {ghosts.map((g) => (
              <div key={g.code}
                onClick={overlay ? () => overlay.openFlights(g.name, flightsByAirline(model!.scoped, g.name)) : undefined}
                role={overlay ? 'button' : undefined}
                style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 6, alignItems: 'baseline', cursor: overlay ? 'pointer' : 'default', borderBottom: '1px solid var(--hair-2)', paddingBottom: 9 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    {airlineLogos[g.code] && <img src={airlineLogos[g.code]} alt={g.name} title={g.name} style={{ height: 18, width: 'auto', maxWidth: 120, objectFit: 'contain', objectPosition: 'left center', flexShrink: 0 }} />}
                    <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', flexShrink: 0 }}>({g.code})</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-2)', fontStyle: 'italic', marginTop: 3 }}>{g.fate} · last flown {g.last}</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, color: ACCENT, fontVariantNumeric: 'tabular-nums' }}>{g.count}×</div>
              </div>
            ))}
          </div>
        )}
        <p style={{ marginTop: 12, fontSize: 11.5, color: 'var(--ink-2)', fontStyle: 'italic' }}>You kept flying while these brands disappeared.</p>
      </CardFrame>
    )
  },
}
