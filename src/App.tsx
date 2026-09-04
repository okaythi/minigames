import { useEffect } from 'react'
import { ErrorBoundary } from './app/error-boundary'
import { AppRoutes } from './app/app-routes'
import { RouterProvider } from './app/router'
import { SiteFooter } from './site/site-footer'
import { SiteHeader } from './site/site-header'
import { StatsProvider } from './services/stats/stats-provider'
import { getVisibleManifests } from './games/registry'
import { useCanSeeBetaGames } from './services/auth-api'
import { AchievementToast } from './components/achievements/achievement-toast'
import { SyncStatusPill } from './components/ui/sync-status-pill'
import { DmDrawer } from './components/chat/dm-drawer'
import { initPresenceTracker } from './services/presence-service'
import { initChatSubsystem } from './services/chat-boot'
import './site/app-shell.css'

export function App() {
  const { canSeeBetaGames } = useCanSeeBetaGames()
  const manifests = getVisibleManifests(canSeeBetaGames)

  useEffect(() => {
    return initPresenceTracker()
  }, [])

  useEffect(() => {
    return initChatSubsystem()
  }, [])

  return (
    <RouterProvider>
      <StatsProvider>
        <div className="nx-shell">
          <SiteHeader manifests={manifests} />
          <main className="nx-main nx-page" id="main">
            <ErrorBoundary>
              <AppRoutes />
            </ErrorBoundary>
          </main>
          <SiteFooter />
          <AchievementToast />
          <SyncStatusPill />
          <DmDrawer />
        </div>
      </StatsProvider>
    </RouterProvider>
  )
}

export default App
