import type { GameFlag } from './flags/types'
import registryData from './game-registry.json'

/**
 * Resolution source for a game:
 * - 'local': in-repo directory inside src/games/<path>
 * - 'package': published or git-referenced npm package (e.g. '@nixlabs-games/space-invaders')
 */
export type GameSource =
  | { readonly type: 'local'; readonly path: string }
  | { readonly type: 'package'; readonly name: string }

export interface GameRegistryEntry {
  /** Unique kebab-case slug representing URL, storage, and D1 row */
  readonly slug: string
  /** Human-readable title for logs, edge records, and diagnostics */
  readonly title: string
  /** Whether the game is actively enabled and accepted by edge/API */
  readonly enabled: boolean
  /** Access flag required to play (e.g. GAME_BETA, STAFF) */
  readonly flag?: GameFlag | undefined
  /** How the game code is sourced */
  readonly source: GameSource
}

/**
 * THE SINGLE SOURCE OF TRUTH FOR ALL GAMES IN NIXLABS MINIGAMES.
 *
 * Both the client application and Cloudflare Pages edge functions / D1 derive
 * their list of allowed games and validation rules directly from this registry.
 */
export const GAME_REGISTRY: readonly GameRegistryEntry[] = registryData as readonly GameRegistryEntry[]

export const findRegistryEntry = (slug: string): GameRegistryEntry | undefined =>
  GAME_REGISTRY.find((entry) => entry.slug === slug)
