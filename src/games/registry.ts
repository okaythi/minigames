import { lazy } from 'react'
import type { GameManifest, GameModule } from './types'
import { isPlayable } from './types'
import { avoidTheSpikesManifest } from './avoid-the-spikes/manifest'
import { pongManifest } from './pong/manifest'

const AvoidTheSpikes = lazy(() => import('./avoid-the-spikes'))
const Pong = lazy(() => import('./pong'))

/**
 * The catalogue. Adding a game means creating `src/games/<slug>/`, exporting a
 * `GameModule` from it and listing it here - nothing else knows about it.
 */
export const GAMES: readonly GameModule[] = [
  { manifest: avoidTheSpikesManifest, Component: AvoidTheSpikes },
  { manifest: pongManifest, Component: Pong },
]

export const MANIFESTS: readonly GameManifest[] = GAMES.map((game) => game.manifest)

const BY_SLUG = new Map<string, GameModule>(GAMES.map((game) => [game.manifest.slug, game]))

export const findGame = (slug: string): GameModule | undefined => BY_SLUG.get(slug)

export const findManifest = (slug: string): GameManifest | undefined =>
  findGame(slug)?.manifest

/** First game a visitor can actually play - used by "Play now" links. */
export const featuredSlug: string | null =
  GAMES.find((game) => isPlayable(game.manifest))?.manifest.slug ?? null

export const gameCount = GAMES.length

