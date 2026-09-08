import { Link } from '../../../app/link'
import { ROUTES } from '../../../app/parse-route'
import {
  isUsersAdmin,
  isGamesAdmin,
  isPlatformAdmin,
  isCmsEditor,
} from '../../../services/auth-api'

interface AdminNavBarProps {
  readonly activeTab: 'users' | 'games' | 'platform' | 'updates'
}

export function AdminNavBar({ activeTab }: AdminNavBarProps) {
  const canUsers = isUsersAdmin()
  const canGames = isGamesAdmin()
  const canPlatform = isPlatformAdmin()
  const canCms = isCmsEditor()

  return (
    <div className="nx-admin-nav-tabs">
      {canUsers && (
        <Link
          to={ROUTES.adminUsers}
          className={`nx-admin-nav-tab ${activeTab === 'users' ? 'active' : ''}`}
        >
          👥 Users
        </Link>
      )}
      {canGames && (
        <Link
          to={ROUTES.adminGames}
          className={`nx-admin-nav-tab ${activeTab === 'games' ? 'active' : ''}`}
        >
          🎮 Games
        </Link>
      )}
      {canPlatform && (
        <Link
          to={ROUTES.adminPlatform}
          className={`nx-admin-nav-tab ${activeTab === 'platform' ? 'active' : ''}`}
        >
          ⚙️ Platform
        </Link>
      )}
      {canCms && (
        <Link
          to={ROUTES.adminUpdates}
          className={`nx-admin-nav-tab ${activeTab === 'updates' ? 'active' : ''}`}
        >
          📝 CMS Tool
        </Link>
      )}
    </div>
  )
}
