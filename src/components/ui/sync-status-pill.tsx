import { useEffect, useState } from 'react'
import { getCurrentUser, subscribeAuth } from '../../services/auth-api'
import './sync-status-pill.css'

/**
 * An unintrusive bottom-left warning pill styled in pastel red (--nx-red).
 * Displayed when cachedCurrentUser is null/undefined to inform the player
 * that account progress and achievements are not being synced.
 *
 * (Note: will be migrated to the global Notification Engine per todo/todo.md)
 */
export function SyncStatusPill() {
  const [user, setUser] = useState(getCurrentUser())
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    return subscribeAuth(() => {
      setUser(getCurrentUser())
    })
  }, [])

  // Do not render if the user is successfully authenticated or manually dismissed
  if (user || dismissed) {
    return null
  }

  const handleOpenLogin = () => {
    window.dispatchEvent(new CustomEvent('nx:open-auth'))
  }

  return (
    <div className="nx-sync-pill" role="status" aria-live="polite">
      <span className="nx-sync-pill-dot" aria-hidden="true" />
      <span className="nx-sync-pill-text">
        There was an error syncing to your user account.{' '}
        <button
          type="button"
          className="nx-sync-pill-action"
          onClick={handleOpenLogin}
        >
          Log in
        </button>{' '}
        in order to save your achievements and progress.
      </span>
      <button
        type="button"
        className="nx-sync-pill-close"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss sync warning"
      >
        ×
      </button>
    </div>
  )
}
