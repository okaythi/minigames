import { AppRoutes } from './app/app-routes'
import { RouterProvider } from './app/router'
import { SiteFooter } from './site/site-footer'
import { SiteHeader } from './site/site-header'
import { StatsProvider } from './services/stats/stats-provider'
import { MANIFESTS } from './games/registry'
import './site/app-shell.css'

export function App() {
  return (
    <RouterProvider>
      <StatsProvider>
        <div className="nx-shell">
          <SiteHeader manifests={MANIFESTS} />
          <main className="nx-main nx-page" id="main">
            <AppRoutes />
          </main>
          <SiteFooter />
        </div>
      </StatsProvider>
    </RouterProvider>
  )
}

export default App
