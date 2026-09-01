/**
 * The slugs the edge is willing to store counters for.
 *
 * Deliberately a list, not a discovery mechanism: without it anyone could POST
 * a new "game" and mint a row per guess. Both the Pages Function and the Vite
 * dev middleware read this file, so `vite dev` refuses exactly what production
 * refuses. Adding a game means one line here and one in the registry.
 */
export const ALLOWED_SLUGS: readonly string[] = ['avoid-the-spikes', 'pong', 'fl-tron-3']

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/

export const isAllowedGameSlug = (slug: string): boolean =>
  SLUG_PATTERN.test(slug) && ALLOWED_SLUGS.includes(slug)
