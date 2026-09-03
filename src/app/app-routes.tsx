import { useEffect } from 'react'
import { HomePage } from '../pages/home-page'
import { GamePage } from '../pages/game-page'
import { AboutPage } from '../pages/about-page'
import { UpdatesPage } from '../pages/updates-page'
import { NotFoundPage } from '../pages/not-found-page'
import { UserProfilePage } from '../pages/user-profile'
import { SettingsPage } from '../pages/settings'
import { AdminUpdatesPage } from '../pages/admin/admin-updates-page'
import { useDocumentTitle } from './use-document-title'
import { useRouter } from './router'

/**
 * Route -> page, plus the two side effects a route change owns: the document
 * title and the scroll position.
 */
export function AppRoutes() {
  const { route } = useRouter()
  useDocumentTitle(route)
  const routeKey = route.name === 'game' ? `game:${route.slug}` : route.name

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [routeKey])

  switch (route.name) {
    case 'home':
      return <HomePage />
    case 'about':
      return <AboutPage />
    case 'updates':
      return <UpdatesPage />
    case 'settings':
      return <SettingsPage />
    case 'admin-updates':
      return <AdminUpdatesPage />
    case 'user-profile':
      return <UserProfilePage username={route.username} />
    case 'game':
      return <GamePage slug={route.slug} />
    case 'not-found':
      return <NotFoundPage path={route.path} />
  }
}

