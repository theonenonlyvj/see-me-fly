import type { ReactNode } from 'react'
import type { Model } from '../state/useModel'
import type { Settings } from '../../engine'

export interface CardContext { model: Model; settings: Settings }
export interface CardDef { id: string; title: string; group: 'core' | 'creative'; render: (ctx: CardContext) => ReactNode }

import { overviewCard } from './OverviewCard'
import { distanceCard } from './DistanceCard'
import { airportsCard } from './AirportsCard'
import { airlinesCard } from './AirlinesCard'
import { routesCard } from './RoutesCard'
export const CARDS: CardDef[] = [overviewCard, distanceCard, airportsCard, airlinesCard, routesCard]
