import { useState } from 'react'
import CardFrame from '../components/CardFrame'
import { fmtInt, fmtMiles } from '../lib/format'
import { displayRoute, displayRouteString } from '../lib/places'
import { flightsByRouteKey } from '../lib/flight-filters'
import type { Settings } from '../../engine'
import type { Model } from '../state/useModel'
import type { OverlayApi } from '../components/Overlay'
import type { CardContext, CardDef } from './registry'

const ACCENT      = '#6a3cff'
const ACCENT_GRAD = 'linear-gradient(90deg, #6a3cff, #9a6bff)'
const ACCENT_SOFT = '#ebe4ff'

type Metric = 'count' | 'miles'
type RouteRow = { key: string; count: number; miles: number }

function RouteRows({ routes, metric, peak, settings, model, overlay }: {
  routes: RouteRow[]
  metric: Metric
  peak: number
  settings: Settings
  model: Model
  overlay?: OverlayApi
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
      {routes.map((r) => {
        const parts = displayRoute(r.key, settings)
        const value = metric === 'count' ? r.count : Math.round(r.miles)
        const pct = (value / peak) * 100
        const avgMi = r.count > 0 ? Math.round(r.miles / r.count) : 0
        const sub = metric === 'count' ? `avg ${fmtInt(avgMi)} mi` : `${r.count} flights`
        return (
          <div key={r.key}
            onClick={() => overlay?.openFlights(displayRouteString(r.key, settings), flightsByRouteKey(model!.scoped, r.key, settings))}
            role={overlay ? 'button' : undefined}
            style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '6px 14px', alignItems: 'baseline', cursor: overlay ? 'pointer' : undefined }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 7 }}>
              {parts ? (
                <>
                  <span style={{ color: ACCENT, fontWeight: 800 }}>{parts.left}</span>
                  <span style={{ color: ACCENT, fontWeight: 800 }}>{parts.sep}</span>
                  {parts.right}
                </>
              ) : r.key}
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums', textAlign: 'right', whiteSpace: 'nowrap' }}>
              {metric === 'count' ? fmtInt(value) : fmtMiles(value)}{' '}
              <small style={{ fontWeight: 500, color: 'var(--ink-2)', fontSize: 12 }}>· {sub}</small>
            </div>
            <div style={{ gridColumn: '1 / -1', height: 13, borderRadius: 999, background: ACCENT_SOFT, overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 999, width: `${pct}%`, background: ACCENT_GRAD, boxShadow: `0 0 16px -2px color-mix(in srgb, ${ACCENT} 80%, transparent)` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Routes({ model, settings, overlay }: CardContext) {
  const [metric, setMetric] = useState<Metric>('count')
  const sorted = [...model!.byRoute].sort((a, b) => metric === 'count' ? b.count - a.count : b.miles - a.miles)
  const peak = Math.max(...sorted.map((r) => metric === 'count' ? r.count : r.miles), 1)

  const toggle = (
    <div style={{ display: 'inline-flex', padding: 3, gap: 2, marginBottom: 18, background: ACCENT_SOFT, borderRadius: 12, border: `1px solid color-mix(in srgb, ${ACCENT} 24%, transparent)` }}>
      {(['count', 'miles'] as Metric[]).map((m) => (
        <button key={m} onClick={() => setMetric(m)}
          style={{
            fontFamily: 'var(--font)', fontSize: 12, fontWeight: 800,
            border: 'none', cursor: 'pointer', padding: '6px 13px', borderRadius: 9,
            color: metric === m ? '#fff' : ACCENT,
            background: metric === m ? `linear-gradient(90deg, ${ACCENT}, #9a6bff)` : 'transparent',
            boxShadow: metric === m ? `0 5px 12px -4px color-mix(in srgb, ${ACCENT} 78%, transparent)` : 'none',
          }}>
          {m === 'count' ? '# flights' : 'miles'}
        </button>
      ))}
    </div>
  )

  return (
    <CardFrame title="Top routes" eyebrow="Your corridors" accent={ACCENT} accentGrad={ACCENT_GRAD} accentSoft={ACCENT_SOFT} icon="🛫"
      onTitleClick={() => overlay?.openFlights('Top routes', model!.scoped)}>
      {toggle}
      <RouteRows routes={sorted.slice(0, 5)} metric={metric} peak={peak} settings={settings} model={model} overlay={overlay} />
      {sorted.length > 5 && (
        <button
          onClick={() => overlay?.openList('Top routes', <RouteRows routes={sorted} metric={metric} peak={peak} settings={settings} model={model} overlay={overlay} />)}
          style={{
            marginTop: 18, fontSize: 12.5, fontWeight: 800,
            background: ACCENT_GRAD, WebkitBackgroundClip: 'text', backgroundClip: 'text',
            WebkitTextFillColor: 'transparent', color: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
          }}
        >{`See all (${sorted.length}) →`}</button>
      )}
    </CardFrame>
  )
}

export const routesCard: CardDef = {
  id: 'routes',
  title: 'Routes',
  group: 'core',
  accent: ACCENT,
  icon: '🛫',
  render: (ctx: CardContext) => <Routes {...ctx} />,
}
