import { lazy, createElement } from 'react'
import type { GameManifest, GameModule, GamePlugin } from './types'
import { isPlayable } from './types'
import { hasGameFlag, GameFlags } from '../../shared/flags'
import { avoidTheSpikesPlugin } from '@nixlabs-games/avoid-the-spikes'

import { pongPlugin } from '@nixlabs-games/pong'
import { flTron3Plugin } from '@nixlabs-games/fl-tron-3'
import { manifest as cardJitsuManifest } from './card-jitsu/manifest'
import { cardJitsuProfileCard } from './card-jitsu/profile-card'

const CardJitsu = lazy(() => import('./card-jitsu'))

function wrapPluginComponent(
  plugin: GamePlugin,
): React.LazyExoticComponent<React.ComponentType<Record<string, never>>> {
  if (plugin.Component) {
    return plugin.Component as React.LazyExoticComponent<
      React.ComponentType<Record<string, never>>
    >
  }
  return lazy(async () => {
    const { GameTemplate } = await import('./template/game-template')
    return {
      default: function PluginGameStage() {
        if (!plugin.createRuntime) {
          return null
        }
        return createElement(GameTemplate, {
          game: { manifest: plugin.manifest, createRuntime: plugin.createRuntime },
          renderLeft: plugin.renderLeft,
        })
      },
    }
  })
}

/**
 * Registered Game Plugins.
 * Future games from separate repositories export a GamePlugin conforming to the
 * shared contract, which registers here with zero modifications to platform UI components.
 */
export const PLUGINS: readonly GamePlugin[] = [
  avoidTheSpikesPlugin,
  pongPlugin,
  flTron3Plugin,
  {
    manifest: cardJitsuManifest,
    Component: CardJitsu,
    profileCard: cardJitsuProfileCard,
    scoring: {
      mode: 'custom',
      hasValidScore: (_score) => true,
    },
  },
]

const PLUGIN_MAP = new Map<string, GamePlugin>(
  PLUGINS.map((plugin) => [plugin.manifest.slug, plugin]),
)

export const getGamePlugin = (slug: string): GamePlugin | undefined => PLUGIN_MAP.get(slug)

export const GAMES: readonly GameModule[] = PLUGINS.map((plugin) => ({
  manifest: plugin.manifest,
  Component: wrapPluginComponent(plugin),
  plugin,
}))

export const MANIFESTS: readonly GameManifest[] = GAMES.map((game) => game.manifest)

const BY_SLUG = new Map<string, GameModule>(GAMES.map((game) => [game.manifest.slug, game]))

export const findGame = (slug: string): GameModule | undefined => BY_SLUG.get(slug)

export const findManifest = (slug: string): GameManifest | undefined =>
  findGame(slug)?.manifest

/** First game a visitor can actually play - used by "Play now" links. */
export const featuredSlug: string | null =
  GAMES.find((game) => isPlayable(game.manifest))?.manifest.slug ?? null

export const gameCount = GAMES.length

/**
 * Returns the game modules visible to the user.
 * If canSeeBeta is true, includes GAME_BETA games; otherwise excludes them.
 */
export function getVisibleGames(canSeeBeta: boolean): readonly GameModule[] {
  if (canSeeBeta) return GAMES
  return GAMES.filter((g) => !hasGameFlag(g.manifest, GameFlags.GAME_BETA))
}


/**
 * Returns the game manifests visible to the user.
 */
export function getVisibleManifests(canSeeBeta: boolean): readonly GameManifest[] {
  return getVisibleGames(canSeeBeta).map((g) => g.manifest)
}
