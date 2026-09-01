/**
 * The two responses this API ever sends: JSON with a cache decision, and an
 * optional cookie. Both routes go through here so the caching rule for
 * player-specific data cannot be forgotten in one of them.
 */

export interface RespondOptions {
  /** Seconds a *shared* answer may be cached for. Absent means "private". */
  readonly cacheSeconds?: number | undefined
  readonly cookie?: string | null
  readonly headers?: Readonly<Record<string, string>> | undefined
}

export function jsonResponse(status: number, payload: unknown, options: RespondOptions = {}): Response {
  const headers = new Headers(options.headers)
  headers.set('content-type', 'application/json; charset=utf-8')
  // Anything that carries a player's own row is that player's business only.
  headers.set(
    'cache-control',
    status === 200 && options.cacheSeconds !== undefined
      ? `public, max-age=${options.cacheSeconds}`
      : 'private, no-store',
  )
  if (options.cookie !== null && options.cookie !== undefined) {
    headers.append('set-cookie', options.cookie)
  }
  return new Response(JSON.stringify(payload), { status, headers })
}

export function badRequest(reason: string): Response {
  return jsonResponse(400, { ok: false, stats: null, player: null, error: reason })
}
