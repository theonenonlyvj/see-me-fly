// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { WorldMap } from '../../app/components/charts/WorldMap'
import { buildModel, DEFAULT_SETTINGS } from '../../engine'
import { REQUIRED_COLUMNS } from '../../engine/parse'

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

// DFW→AUS (domestic), DFW→LHR (intercontinental) — both resolve
const csv = [
  REQUIRED_COLUMNS.join(','),
  makeRow('2023-03-10', 'DFW', 'AUS'),
  makeRow('2023-06-15', 'DFW', 'LHR'),
  makeRow('2023-09-20', 'AUS', 'DFW'),
].join('\n')

describe('WorldMap', () => {
  it('renders an svg element', () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    const { container: c } = render(<WorldMap flights={model.scoped} accent="#1aa9ff" />)
    const svg = c.querySelector('svg')
    expect(svg).not.toBeNull()
  })

  it('renders more than 50 country paths', () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    const { container: c } = render(<WorldMap flights={model.scoped} accent="#1aa9ff" />)
    const paths = c.querySelectorAll('path[data-country]')
    expect(paths.length).toBeGreaterThan(50)
  })

  it('renders at least one arc path for the resolved routes', () => {
    const model = buildModel(csv, DEFAULT_SETTINGS, '2026-06-25')
    const { container: c } = render(<WorldMap flights={model.scoped} accent="#1aa9ff" />)
    const arcs = c.querySelectorAll('path[data-arc]')
    expect(arcs.length).toBeGreaterThanOrEqual(1)
  })
})
