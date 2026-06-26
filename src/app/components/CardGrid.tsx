import { CARDS } from '../cards/registry'
import type { Model } from '../state/useModel'
import type { Settings } from '../../engine'

export default function CardGrid({ model, settings }: { model: Model; settings: Settings }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--gap)', padding: 'var(--pad)' }}>
      {CARDS.map((c) => (
        <div key={c.id}>{c.render({ model, settings })}</div>
      ))}
    </div>
  )
}
