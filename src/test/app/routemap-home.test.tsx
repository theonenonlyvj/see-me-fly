// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { RouteMapV2 } from '../../app/components/charts/RouteMapV2'
import { buildModel, DEFAULT_SETTINGS } from '../../engine'
import { REQUIRED_COLUMNS } from '../../engine/parse'

afterEach(cleanup)

function makeRow(date: string, from: string, to: string): string {
  const fields = new Array<string>(REQUIRED_COLUMNS.length).fill('')
  fields[0] = date
  fields[1] = 'AAL'
  fields[2] = '1'
  fields[3] = from
  fields[4] = to
  fields[9] = 'false'
  return fields.join(',')
}

// Touch CMH, DFW, AUS — CMH & DFW are both home (different eras).
const csv = [
  REQUIRED_COLUMNS.join(','),
  makeRow('2010-03-10', 'CMH', 'AUS'),
  makeRow('2020-06-15', 'DFW', 'AUS'),
  makeRow('2020-09-20', 'AUS', 'DFW'),
].join('\n')

// A node dot is "home" when it has a thick accent-colored ring (strokeWidth 2.5 / fill #fff).
function homeDots(container: HTMLElement): Element[] {
  return [...container.querySelectorAll('circle')].filter(
    (c) => c.getAttribute('fill') === '#fff',
  )
}

describe('RouteMapV2 home anchor (date-less union)', () => {
  it('rings EVERY home-key member, not just one', () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    const homeKeys = new Set(['CMH', 'DFW'])
    const { container } = render(
      <RouteMapV2 flights={model.scoped} accent="#1aa9ff" homeKeys={homeKeys} primaryKey="DFW" />,
    )
    // both CMH and DFW dots should be ringed → 2 home dots
    expect(homeDots(container).length).toBe(2)
  })

  it('emphasizes the primaryKey dot above the others', () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    const homeKeys = new Set(['CMH', 'DFW'])
    const { container } = render(
      <RouteMapV2 flights={model.scoped} accent="#1aa9ff" homeKeys={homeKeys} primaryKey="DFW" />,
    )
    const rings = homeDots(container)
    // exactly one of the two home dots is the emphasized primary (thicker stroke).
    const strokeWidths = rings.map((c) => parseFloat(c.getAttribute('stroke-width') ?? '0'))
    const maxW = Math.max(...strokeWidths)
    expect(strokeWidths.filter((w) => w === maxW).length).toBe(1)
  })

  it('rings nothing when there is no home', () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    const { container } = render(
      <RouteMapV2 flights={model.scoped} accent="#1aa9ff" homeKeys={null} primaryKey={null} />,
    )
    expect(homeDots(container).length).toBe(0)
  })

  it('still rings a single legacy home key', () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    const { container } = render(
      <RouteMapV2 flights={model.scoped} accent="#1aa9ff" homeKeys={new Set(['DFW'])} primaryKey="DFW" />,
    )
    expect(homeDots(container).length).toBe(1)
  })
})
