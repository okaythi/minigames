import { useState, useEffect } from 'react'
import { Link } from '../app/link'
import { useRouter } from '../app/router'
import { ROUTES } from '../app/parse-route'
import type { GameManifest } from '../games/types'
import { BrandLockup } from './brand-lockup'
import { SearchBar } from './search/search-bar'
import { PlayerSearchBar } from './search/player-search-bar'
import { AuthPopover } from './auth-popover'
import { NotificationBell } from './notification-bell'
import { TopBanner } from './top-banner'
import { canAccessAdmin, getDefaultAdminRoute, subscribeAuth } from '../services/auth-api'
import './site-header.css'

interface SiteHeaderProps {
  readonly manifests: readonly GameManifest[]
}

export function SiteHeader({ manifests }: SiteHeaderProps) {
  const { route } = useRouter()
  const [hasAdminAccess, setHasAdminAccess] = useState(() => canAccessAdmin())
  const [adminRoute, setAdminRoute] = useState(() => getDefaultAdminRoute())

  useEffect(() => {
    const update = () => {
      setHasAdminAccess(canAccessAdmin())
      setAdminRoute(getDefaultAdminRoute())
    }
    update()
    return subscribeAuth(update)
  }, [])

  const isUpdates = route.name === 'updates'
  const isGames = route.name === 'home'
  const isAdmin =
    route.name === 'admin-updates' ||
    route.name === 'admin-users' ||
    route.name === 'admin-games' ||
    route.name === 'admin-platform'

  return (
    <>
      <TopBanner />
      <header className="nx-header">
        <div className="nx-header-inner nx-page">
          <Link to={ROUTES.home} className="nx-header-brand" aria-label="Nixlabs Games - home">
            <BrandLockup />
          </Link>

          <div className="nx-header-search">
            <SearchBar manifests={manifests} />
            <PlayerSearchBar />
          </div>

          <nav className="nx-nav" aria-label="Primary">
            <Link to={ROUTES.home} className="nx-nav-link" data-active={isGames ? 'true' : undefined}>
              Games
            </Link>
            <Link to={ROUTES.updates} className="nx-nav-link" data-active={isUpdates ? 'true' : undefined}>
              Updates
            </Link>
            {hasAdminAccess && (
              <Link
                to={adminRoute}
                className="nx-nav-link nx-nav-link-admin"
                data-active={isAdmin ? 'true' : undefined}
              >
                Admin
              </Link>
            )}
            <NotificationBell />
            <AuthPopover />
          </nav>
        </div>
      </header>
    </>
  )
}

