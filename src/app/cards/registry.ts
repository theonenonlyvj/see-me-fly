import type { ReactNode } from 'react'
import type { Model } from '../state/useModel'
import type { Settings } from '../../engine'
import type { OverlayApi } from '../components/Overlay'

export interface CardContext { model: Model; settings: Settings; overlay?: OverlayApi; update?: (patch: Partial<Settings>) => void }
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
import { layoversCard } from './LayoversCard'
import { countriesCard } from './CountriesCard'
import { domesticStateCard, domesticCountryCard, domesticContinentCard } from './SuperDomesticCard'
import { intercontinentalCard } from './IntercontinentalCard'
import { aircraftCard, aircraftClassCard } from './AircraftCard'
import { delaysCard } from './DelaysCard'
import { sameMetalCard } from './SameMetalCard'
import { shortestCard } from './ShortestCard'
import { longestCard } from './LongestCard'
import { odometerCard } from './OdometerCard'
import { recordsCard } from './RecordsCard'
import { geoExtremesCard } from './GeoExtremesCard'
import { whenYouFlyCard } from './WhenYouFlyCard'
import { intensityCard } from './IntensityCard'
import { mapCard } from './MapCard'
import { careerArcCard } from './CareerArcCard'
import { dayOfWeekCard } from './DayOfWeekCard'
import { howFarFromHomeCard } from './HowFarFromHomeCard'
import { aircraftClassBarCard } from './AircraftClassBarCard'
import { airlineErasCard } from './AirlineErasCard'
import { mapV2Card } from './MapV2Card'
import { whenYouFlyOverlayCard } from './WhenYouFlyOverlayCard'
import { redEyesCard } from './RedEyesCard'
import { fleetCard } from './FleetCard'
import { ghostAirlinesCard } from './GhostAirlinesCard'
import { topRouteHeroCard } from './TopRouteHeroCard'
import { flightPersonalityCard } from './FlightPersonalityCard'
import { commuterCadenceCard } from './CommuterCadenceCard'
import { nightsAwayCard } from './NightsAwayCard'
import { alliancesCard } from './AlliancesCard'
import { tripsCard } from './TripsCard'
import { tripsExplorerCard } from './TripsExplorerCard'
export const CARDS: CardDef[] = [
  mapCard, mapV2Card,
  overviewCard, odometerCard, flightPersonalityCard,
  careerArcCard, airlineErasCard,
  airportsCard, routesCard, topRouteHeroCard, layoversCard, airlinesCard, alliancesCard, ghostAirlinesCard, distanceCard,
  countriesCard, domesticStateCard, domesticCountryCard, domesticContinentCard, intercontinentalCard, geoExtremesCard, howFarFromHomeCard,
  whenYouFlyCard, whenYouFlyOverlayCard, dayOfWeekCard, redEyesCard, commuterCadenceCard, nightsAwayCard, tripsCard, tripsExplorerCard, intensityCard,
  aircraftCard, aircraftClassCard, aircraftClassBarCard, sameMetalCard, fleetCard,
  recordsCard, delaysCard,
  shortestCard, longestCard,
]
