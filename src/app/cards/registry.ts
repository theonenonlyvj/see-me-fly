import type { ReactNode } from 'react'
import type { Model } from '../state/useModel'
import type { Settings } from '../../engine'

export interface CardContext { model: Model; settings: Settings }
export interface CardDef {
  id: string
  title: string
  group: 'core' | 'creative'
  accent: string
  icon: string
  render: (ctx: CardContext) => ReactNode
}

import { overviewCard } from './OverviewCard'
import { distanceCard } from './DistanceCard'
import { airportsCard } from './AirportsCard'
import { airlinesCard } from './AirlinesCard'
import { routesCard } from './RoutesCard'
import { countriesCard } from './CountriesCard'
import { superDomesticCard } from './SuperDomesticCard'
import { intercontinentalCard } from './IntercontinentalCard'
import { aircraftCard } from './AircraftCard'
import { delaysCard } from './DelaysCard'
export const CARDS: CardDef[] = [
  overviewCard, distanceCard, airportsCard, airlinesCard, routesCard,
  countriesCard, superDomesticCard, intercontinentalCard, aircraftCard, delaysCard,
]
