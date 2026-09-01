import { Link } from '../app/link'
import { useState } from 'react'
import { useRouter } from '../app/router'
import { ROUTES } from '../app/parse-route'
import type { GameManifest } from '../games/types'
import { BrandLockup } from './brand-lockup'
import { SearchBar } from './search/search-bar'
import { SyncModal } from './sync-modal'
import './site-header.css'

interface SiteHeaderProps {
  readonly manifests: readonly GameManifest[]
}

export function SiteHeader({ manifests }: SiteHeaderProps) {
  const { route } = useRouter()
  const isAbout = route.name === 'about'
  const [syncOpen, setSyncOpen] = useState(false)

  return (
    <header className="nx-header">
      <div className="nx-header-inner nx-page">
        <Link to={ROUTES.home} className="nx-header-brand" aria-label="Nixlabs Games - home">
          <BrandLockup />
        </Link>

        <div className="nx-header-search">
          <SearchBar manifests={manifests} />
        </div>

        <nav className="nx-nav" aria-label="Primary">
          <Link to={ROUTES.home} className="nx-nav-link" data-active={route.name !== 'about' ? 'true' : undefined}>
            Games
          </Link>
          <Link to={ROUTES.about} className="nx-nav-link" data-active={isAbout ? 'true' : undefined}>
            About
          </Link>
          <button className="nx-nav-link" onClick={() => setSyncOpen(true)} style={{ marginLeft: 8 }}>
            Sync
          </button>
        </nav>
        <SyncModal open={syncOpen} onClose={() => setSyncOpen(false)} />
      </div>
    </header>
  )
}
