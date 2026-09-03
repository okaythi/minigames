import { useEffect } from 'react'
import { ErrorBoundary } from './app/error-boundary'
import { AppRoutes } from './app/app-routes'
import { RouterProvider } from './app/router'
import { SiteFooter } from './site/site-footer'
import { SiteHeader } from './site/site-header'
import { StatsProvider } from './services/stats/stats-provider'
import { MANIFESTS } from './games/registry'
import { AchievementToast } from './components/achievements/achievement-toast'
import { SyncStatusPill } from './components/ui/sync-status-pill'
import { DmDrawer } from './components/chat/dm-drawer'
import { initPresenceTracker } from './services/presence-service'
import './site/app-shell.css'

export function App() {
  useEffect(() => {
    return initPresenceTracker()
  }, [])

  return (
    <RouterProvider>
      <StatsProvider>
        <div className="nx-shell">
          <SiteHeader manifests={MANIFESTS} />
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
