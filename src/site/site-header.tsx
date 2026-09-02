import { Link } from '../app/link'
import { useRouter } from '../app/router'
import { ROUTES } from '../app/parse-route'
import type { GameManifest } from '../games/types'
import { BrandLockup } from './brand-lockup'
import { SearchBar } from './search/search-bar'
import { AuthPopover } from './auth-popover'
import { TopBanner } from './top-banner'
import './site-header.css'

interface SiteHeaderProps {
  readonly manifests: readonly GameManifest[]
}

export function SiteHeader({ manifests }: SiteHeaderProps) {
  const { route } = useRouter()
  const isAbout = route.name === 'about'
  const isUpdates = route.name === 'updates'
  const isGames = route.name === 'home'

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
          </div>

          <nav className="nx-nav" aria-label="Primary">
            <Link to={ROUTES.home} className="nx-nav-link" data-active={isGames ? 'true' : undefined}>
              Games
            </Link>
            <Link to={ROUTES.updates} className="nx-nav-link" data-active={isUpdates ? 'true' : undefined}>
              Updates
            </Link>
            <Link to={ROUTES.about} className="nx-nav-link" data-active={isAbout ? 'true' : undefined}>
              About
            </Link>
            <AuthPopover />
          </nav>
        </div>
      </header>
    </>
  )
}
