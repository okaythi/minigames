import { useEffect, useState } from 'react'
import { getMe } from '../services/auth-api'
import { fetchAllStats } from '../services/stats/stats-api'
import { useDismissible } from '../services/storage/dismissibles-store'
import { getMigrationTimeRemaining } from './migration-countdown'
import { LATEST_UPDATE } from '../data/updates'
import { Link } from '../app/link'
import { ROUTES } from '../app/parse-route'
import './top-banner.css'

/**
 * Top notification banner coordinating the 28-day migration warning and update notes CTA.
 *
 * Priority 1: 28-day countdown warning for anonymous players with active stats.
 * Priority 2: Update notes announcement CTA leading directly to /updates.
 *
 * Integrated with the enterprise-grade dismissibles store (€0, <1µs latency).
 */
export function TopBanner() {
  const [hasAnonymousStats, setHasAnonymousStats] = useState(false)
  const [isRegistered, setIsRegistered] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState(getMigrationTimeRemaining)

  // Dismissals
  const [migrationDismissed, dismissMigration] = useDismissible('migration_countdown_banner', {
    ttlMs: 24 * 60 * 60 * 1000, // 24-hour snooze
  })
  const [updateDismissed, dismissUpdate] = useDismissible('update_notes_cta', {
    version: LATEST_UPDATE.version,
  })

  // Periodically refresh countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining(getMigrationTimeRemaining())
    }, 60 * 1000)
    return () => clearInterval(timer)
  }, [])

  // Check auth and player status
  useEffect(() => {
    let cancelled = false

    async function checkStatus() {
      const me = await getMe()
      if (cancelled) return
      if (me) {
        setIsRegistered(true)
        return
      }

      const stats = await fetchAllStats()
      if (cancelled) return
      if (stats?.player) {
        setHasAnonymousStats(true)
      }
    }

    void checkStatus()
    return () => {
      cancelled = true
    }
  }, [])

  // Priority 1: Migration Warning (Anonymous + has stats + not registered + not dismissed)
  const showMigration = !isRegistered && hasAnonymousStats && !migrationDismissed

  if (showMigration) {
    return (
      <aside className="nx-top-banner" data-kind="migration" role="alert">
        <div className="nx-top-banner-inner">
          <span>
            ⚠️ <strong>Create an account to save your progress!</strong> Anonymous accounts are permanently deleted in{' '}
            <strong>{timeRemaining}</strong>.
          </span>
          <button
            type="button"
            className="nx-top-banner-action-btn"
            onClick={() => {
              // Scroll to top or trigger auth button click
              const authBtn = document.querySelector<HTMLButtonElement>('.nx-header .nx-nav-link:last-of-type')
              authBtn?.click()
            }}
          >
            Save Progress
          </button>
        </div>
        <button
          type="button"
          className="nx-top-banner-close"
          onClick={dismissMigration}
          aria-label="Dismiss migration warning for 24 hours"
          title="Dismiss for 24 hours"
        >
          ✕
        </button>
      </aside>
    )
  }

  // Priority 2: Update Notes Announcement CTA
  if (!updateDismissed) {
    return (
      <aside className="nx-top-banner" data-kind="update" role="status">
        <div className="nx-top-banner-inner">
          <span>🚀 <strong>Update {LATEST_UPDATE.version}:</strong> {LATEST_UPDATE.headline}</span>
          <Link to={ROUTES.updates} className="nx-top-banner-cta">
            Read Patch Notes →
          </Link>
        </div>
        <button
          type="button"
          className="nx-top-banner-close"
          onClick={dismissUpdate}
          aria-label="Dismiss update notes banner"
          title="Dismiss announcement"
        >
          ✕
        </button>
      </aside>
    )
  }

  return null
}
