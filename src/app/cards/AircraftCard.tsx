import CardFrame from '../components/CardFrame'
import BarList from '../components/charts/BarList'
import type { BarRow } from '../components/charts/BarList'
import { byAircraft } from '../../engine/stats'
import { aircraftBrand, aircraftFamily, classifyAircraft } from '../../engine/reference'
import { flightsByAircraftClass, flightsByAircraftBrand, flightsByAircraftFamily, flightsByAircraftType } from '../lib/flight-filters'
import type { CardContext, CardDef } from './registry'

const ACCENT      = '#ff3d57'
const ACCENT_GRAD = 'linear-gradient(90deg, #ff3d57, #ff7a14)'
const ACCENT_SOFT = '#ffe8ec'

const CLASS_LABEL: Record<string, string> = {
  wide: 'Widebody', narrow: 'Narrowbody', regional: 'Regional jet', prop: 'Propeller', unclassified: 'Unclassified',
}

// ── Card 1: aircraft class (body type), with type drill-down like the brand card ──────────────
export const aircraftClassCard: CardDef = {
  id: 'aircraftClass',
  title: 'Aircraft class',
  group: 'creative',
  accent: ACCENT,
  icon: '🛩️',
  render: (ctx: CardContext) => {
    const { byClass, byType } = byAircraft(ctx.model!.scoped)
    const typesByClass = new Map<string, { type: string; count: number }[]>()
    for (const t of byType) {
      const cls = classifyAircraft(t.type)
      if (!typesByClass.has(cls)) typesByClass.set(cls, [])
      typesByClass.get(cls)!.push(t)
    }
    const rows: BarRow[] = byClass.map((c) => {
      const types = (typesByClass.get(c.cls) ?? []).sort((a, b) => b.count - a.count)
      return {
        label: CLASS_LABEL[c.cls] ?? c.cls,
        value: c.count,
        sub: types.length ? `(${types.length} type${types.length === 1 ? '' : 's'})` : undefined,
        subRows: types.map((t) => ({ label: t.type, value: t.count })),
        id: c.cls,
      }
    })
    return (
      <CardFrame title="Aircraft class" eyebrow="Body types" accent={ACCENT} accentGrad={ACCENT_GRAD} accentSoft={ACCENT_SOFT} icon="🛩️"
        onTitleClick={() => ctx.overlay?.openFlights('All flights by aircraft', ctx.model!.scoped)}>
        <BarList rows={rows} max={rows.length} formatValue={(n) => `${n}`} accent={ACCENT} accentGrad={ACCENT_GRAD} accentSoft={ACCENT_SOFT}
          onRowClick={(row) => row.id && ctx.overlay?.openFlights(`${row.label} flights`, flightsByAircraftClass(ctx.model!.scoped, row.id))}
          onSubRowClick={(s) => ctx.overlay?.openFlights(`${s.label} flights`, flightsByAircraftType(ctx.model!.scoped, s.label))} />
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
      <CardFrame title="Aircraft" eyebrow="By manufacturer" accent={BACCENT} accentGrad={BACCENT_GRAD} accentSoft={BACCENT_SOFT} icon="✈️"
        onTitleClick={() => ctx.overlay?.openFlights('All flights by aircraft', ctx.model!.scoped)}>
        <BarList
          rows={rows}
          max={rows.length}
          formatValue={(n) => `${n}`}
          accent={BACCENT}
          accentGrad={BACCENT_GRAD}
          accentSoft={BACCENT_SOFT}
          onRowClick={(row) => row.id && ctx.overlay?.openFlights(`${row.id} flights`, flightsByAircraftBrand(ctx.model!.scoped, row.id))}
          onSubRowClick={(s) => ctx.overlay?.openFlights(`${s.label} flights`, flightsByAircraftFamily(ctx.model!.scoped, s.label))}
        />
        <p style={{ marginTop: 14, fontSize: 11.5, color: 'var(--ink-2)', fontStyle: 'italic' }}>
          Click a brand for a map of everywhere you flew it; expand to drill into models.
        </p>
      </CardFrame>
    )
  },
}
