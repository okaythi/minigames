import type { Route } from './route-types'

/** Path -> typed route. No framework, no dependency, exhaustive in the switch. */

export const ROUTES = {
  home: '/',
  about: '/about',
  updates: '/updates',
  settings: '/settings',
  adminUpdates: '/admin/updates',
  game: (slug: string): string => `/games/${slug}`,
  userProfile: (username: string): string => `/users/${username}`,
} as const

export const GAME_SEGMENT = '/games/' as const
export const USER_SEGMENT = '/users/' as const

export function parseRoute(pathname: string, search: string): Route {
  const path = normalizePathname(pathname)

  if (path === '/') {
    return { name: 'home', query: readQuery(search) }
  }

  if (path === '/about') {
    return { name: 'about', query: readQuery(search) }
  }

  if (path === '/updates') {
    return { name: 'updates', query: readQuery(search) }
  }

  if (path === '/settings') {
    return { name: 'settings', query: readQuery(search) }
  }

  if (path === '/admin/updates') {
    return { name: 'admin-updates', query: readQuery(search) }
  }


  if (path.startsWith(GAME_SEGMENT)) {
    const slug = path.slice(GAME_SEGMENT.length).replace(/\/+$/, '')
    if (slug.length > 0) {
      return { name: 'game', slug, query: readQuery(search) }
    }
  }

  if (path.startsWith(USER_SEGMENT)) {
    const username = path.slice(USER_SEGMENT.length).replace(/\/+$/, '')
    if (username.length > 0) {
      return { name: 'user-profile', username, query: readQuery(search) }
    }
  }

  return { name: 'not-found', path, query: readQuery(search) }
}

export function normalizePathname(pathname: string): string {
  const withoutTrailing = pathname.endsWith('/') && pathname.length > 1
    ? pathname.slice(0, -1)
    : pathname
  return withoutTrailing.length === 0 ? '/' : withoutTrailing
}

function readQuery(search: string): Readonly<Record<string, string>> {
  const params = new URLSearchParams(search)
  const result: Record<string, string> = {}
  for (const [key, value] of params) {
    result[key] = value
  }
  return result
}
