import { CARDS } from '../cards/registry'
import type { Model } from '../state/useModel'
import type { Settings } from '../../engine'

export default function CardGrid({ model, settings }: { model: Model; settings: Settings }) {
  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '14px 28px 80px' }}>
      <div
        style={{
          // CSS columns masonry
          columnCount: 3,
          columnGap: 24,
        }}
        className="masonry-grid"
      >
        {CARDS.map((c) => (
          <div key={c.id} style={c.id === 'map' ? { columnSpan: 'all' } : { breakInside: 'avoid' }}>
            {c.render({ model, settings })}
          </div>
        ))}
      </div>
      <style>{`
        .masonry-grid { column-count: 3; }
        @media (max-width: 980px) { .masonry-grid { column-count: 2; } }
        @media (max-width: 640px) { .masonry-grid { column-count: 1; } }
      `}</style>
    </div>
  )
}
