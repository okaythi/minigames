import { useEffect, useState } from 'react'
import { getMe } from '../services/auth-api'
import { fetchAllStats } from '../services/stats/stats-api'

export function MigrationBanner() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    async function checkMigration() {
      const me = await getMe()
      if (me) {
        // Already registered, no need to migrate
        return
      }
      
      const stats = await fetchAllStats()
      if (stats && stats.player) {
        // Has a player record (legacy anonymous) but is not registered!
        setShow(true)
      }
    }
    checkMigration()
  }, [])

  if (!show) return null

  return (
    <div style={{
      background: 'var(--nx-orange-tint)',
      color: 'var(--nx-orange-deep)',
      padding: '12px 16px',
      textAlign: 'center',
      fontSize: '14px',
      fontWeight: 500,
      borderBottom: 'var(--nx-hairline)',
    }}>
      ⚠️ Create an account to save your progress! Anonymous accounts are permanently deleted after 28 days of inactivity.
    </div>
  )
}
