import { Link } from '../../../app/link'
import { ROUTES } from '../../../app/parse-route'
import { getCurrentUser } from '../../../services/auth-api'
import '../admin-updates-page.css'

interface AdminRestrictedCardProps {
  readonly title: string
  readonly requiredFlags: string
  readonly panelName: string
}

export function AdminRestrictedCard({
  title,
  requiredFlags,
  panelName,
}: AdminRestrictedCardProps) {
  const user = getCurrentUser()

  return (
    <div className="nx-admin-restricted-page nx-page">
      <div className="nx-restricted-card">
        <div className="nx-restricted-icon">🛡️</div>
        <h1 className="nx-restricted-title">{title}</h1>
        <p className="nx-restricted-text">
          Access to {panelName} is restricted to verified Nixlabs staff holding the{' '}
          <code className="nx-md-inline-code">STAFF</code> and{' '}
          <code className="nx-md-inline-code">{requiredFlags}</code> flags.
        </p>
        {user ? (
          <p className="nx-restricted-user">
            Signed in as <strong>@{user.username}</strong> (Missing required platform flags).
          </p>
        ) : (
          <p className="nx-restricted-user">You are currently not signed in.</p>
        )}
        <div className="nx-restricted-actions">
          <Link to={ROUTES.home} className="nx-btn nx-btn-secondary">
            Back to Arcade
          </Link>
          {!user && (
            <button
              type="button"
              className="nx-btn nx-btn-primary"
              onClick={() => {
                window.dispatchEvent(new CustomEvent('nx:open-auth'))
              }}
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
