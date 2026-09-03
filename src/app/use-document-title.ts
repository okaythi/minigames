import { useEffect } from 'react'
import type { Route } from './route-types'
import { findManifest } from '../games/registry'

export const SITE_TITLE = 'Nixlabs | Minigames'

/**
 * The tab title follows the route. Game routes use the manifest title, which is
 * the one place it is written, so a rename can never desync the two.
 */
export function titleForRoute(route: Route): string {
  switch (route.name) {
    case 'home':
      return SITE_TITLE
    case 'updates':
      return `Update Notes · ${SITE_TITLE}`
    case 'game':
      return `${findManifest(route.slug)?.title ?? route.slug} · ${SITE_TITLE}`
    case 'not-found':
      return `Not found · ${SITE_TITLE}`
    case 'settings':
      return `Settings · ${SITE_TITLE}`
    case 'admin-updates':
      return `Update Notes CMS · ${SITE_TITLE}`
    case 'user-profile':
      return `@${route.username} · ${SITE_TITLE}`
    case 'user-friends':
      return `@${route.username}'s Friends · ${SITE_TITLE}`
  }
}


export function useDocumentTitle(route: Route): void {
  const title = titleForRoute(route)
  useEffect(() => {
    document.title = title
  }, [title])
}
