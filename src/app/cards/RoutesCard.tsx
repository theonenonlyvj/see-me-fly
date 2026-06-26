import { useState } from 'react'
import CardFrame from '../components/CardFrame'
import BarList from '../components/charts/BarList'
import { fmtInt, fmtMiles } from '../lib/format'
import type { CardContext, CardDef } from './registry'

function Routes({ model }: CardContext) {
  const [metric, setMetric] = useState<'count' | 'miles'>('count')
  const rows = [...model!.byRoute]
    .sort((a, b) => (metric === 'count' ? b.count - a.count : b.miles - a.miles))
    .map((r) => ({ label: r.key, value: metric === 'count' ? r.count : Math.round(r.miles) }))
  const toggle = (
    <div style={{ display: 'inline-flex', gap: 4 }}>
      {(['count', 'miles'] as const).map((m) => (
        <button key={m} onClick={() => setMetric(m)}
          style={{ background: metric === m ? 'var(--accent)' : 'transparent', color: metric === m ? '#06121f' : 'var(--text-dim)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '2px 10px' }}>
          {m === 'count' ? '# flights' : 'miles'}
        </button>
      ))}
    </div>
  )
  return (
    <CardFrame title="Top routes" footer={toggle}>
      <BarList rows={rows} max={10} formatValue={(n) => (metric === 'count' ? fmtInt(n) : fmtMiles(n))} />
    </CardFrame>
  )
}

export const routesCard: CardDef = {
  id: 'routes',
  title: 'Routes',
  group: 'core',
  render: (ctx: CardContext) => <Routes {...ctx} />,
}
