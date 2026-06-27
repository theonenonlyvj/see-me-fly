import CardFrame from '../components/CardFrame'
import BarList from '../components/charts/BarList'
import type { BarRow } from '../components/charts/BarList'
import { byAircraft } from '../../engine/stats'
import { aircraftBrand, aircraftFamily } from '../../engine/reference'
import type { CardContext, CardDef } from './registry'

const ACCENT      = '#ff3d57'
const ACCENT_GRAD = 'linear-gradient(90deg, #ff3d57, #ff7a14)'
const ACCENT_SOFT = '#ffe8ec'

const CLASS_LABEL: Record<string, string> = {
  wide: 'Widebody', narrow: 'Narrowbody', regional: 'Regional jet', prop: 'Propeller', unclassified: 'Unclassified',
}

// ── Card 1: aircraft class (body type) ───────────────────────────────────────
export const aircraftClassCard: CardDef = {
  id: 'aircraftClass',
  title: 'Aircraft class',
  group: 'creative',
  accent: ACCENT,
  icon: '🛩️',
  render: (ctx: CardContext) => {
    const { byClass } = byAircraft(ctx.model!.scoped)
    const rows: BarRow[] = byClass.map((c) => ({ label: CLASS_LABEL[c.cls] ?? c.cls, value: c.count }))
    return (
      <CardFrame title="Aircraft class" eyebrow="Body types" accent={ACCENT} accentGrad={ACCENT_GRAD} accentSoft={ACCENT_SOFT} icon="🛩️">
        <BarList rows={rows} max={6} formatValue={(n) => `${n}`} accent={ACCENT} accentGrad={ACCENT_GRAD} accentSoft={ACCENT_SOFT} />
      </CardFrame>
    )
  },
}

// ── Card 2: aircraft by brand → family → exact type ──────────────────────────
const BACCENT      = '#6a3cff'
const BACCENT_GRAD = 'linear-gradient(90deg, #6a3cff, #9a6bff)'
const BACCENT_SOFT = '#ebe4ff'

export const aircraftCard: CardDef = {
  id: 'aircraft',
  title: 'Aircraft',
  group: 'creative',
  accent: BACCENT,
  icon: '✈️',
  render: (ctx: CardContext) => {
    const { byType } = byAircraft(ctx.model!.scoped)
    // brand → { count, families, exact types }
    type BrandAgg = { count: number; families: Map<string, number>; types: { type: string; count: number }[] }
    const brands = new Map<string, BrandAgg>()
    for (const t of byType) {
      const brand = aircraftBrand(t.type)
      const fam = aircraftFamily(t.type)
      const b: BrandAgg = brands.get(brand) ?? { count: 0, families: new Map(), types: [] }
      b.count += t.count
      b.families.set(fam, (b.families.get(fam) ?? 0) + t.count)
      b.types.push(t)
      brands.set(brand, b)
    }

    const entries = [...brands.entries()].sort((a, b) => b[1].count - a[1].count)
    const rows: BarRow[] = entries.map(([brand, b]) => ({
      label: brand,
      value: b.count,
      sub: `(${b.families.size} model${b.families.size === 1 ? '' : 's'})`,
      subRows: [...b.families.entries()].sort((a, c) => c[1] - a[1]).map(([fam, n]) => ({ label: fam, value: n })),
      id: brand,
    }))

    return (
      <CardFrame title="Aircraft" eyebrow="By manufacturer" accent={BACCENT} accentGrad={BACCENT_GRAD} accentSoft={BACCENT_SOFT} icon="✈️">
        <BarList
          rows={rows}
          max={6}
          seeAllTitle="Aircraft by manufacturer"
          formatValue={(n) => `${n}`}
          accent={BACCENT}
          accentGrad={BACCENT_GRAD}
          accentSoft={BACCENT_SOFT}
          onRowClick={(row) => {
            const b = row.id ? brands.get(row.id) : undefined
            if (!b) return
            const typeRows: BarRow[] = [...b.types].sort((x, y) => y.count - x.count).map((t) => ({ label: t.type, value: t.count }))
            ctx.overlay?.openList(`${row.id} — exact types`, <BarList rows={typeRows} max={typeRows.length} formatValue={(n) => `${n}`} accent={BACCENT} accentGrad={BACCENT_GRAD} accentSoft={BACCENT_SOFT} />)
          }}
        />
        <p style={{ marginTop: 14, fontSize: 11.5, color: 'var(--ink-2)', fontStyle: 'italic' }}>
          Expand a brand to see models; click a row for exact types.
        </p>
      </CardFrame>
    )
  },
}
