import { GAME_REGISTRY } from './game-registry.config'

/**
 * The slugs the edge is willing to store counters for.
 * Derived automatically from GAME_REGISTRY so the edge refuses exactly
 * what the registry does not permit.
 */
export const ALLOWED_SLUGS: readonly string[] = GAME_REGISTRY
  .filter((entry) => entry.enabled)
  .map((entry) => entry.slug)

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/

export const isAllowedGameSlug = (slug: string): boolean =>
  SLUG_PATTERN.test(slug) && ALLOWED_SLUGS.includes(slug)

