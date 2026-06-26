import type { ReactNode } from 'react'
import type { Model } from '../state/useModel'
import type { Settings } from '../../engine'

export interface CardContext { model: Model; settings: Settings }
export interface CardDef { id: string; title: string; group: 'core' | 'creative'; render: (ctx: CardContext) => ReactNode }

// Cards are appended here as they are implemented (Tasks 7-12 etc.).
export const CARDS: CardDef[] = []
