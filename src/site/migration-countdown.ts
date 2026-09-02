/**
 * 28-day migration cutoff and live countdown formatting.
 *
 * Rules:
 *  - If >= 24h: format as days (e.g. "27 days", "14 days")
 *  - If < 23h59: format as hours only, no minutes! (e.g. "18 hours", "1 hour")
 *  - If < 59m: format strictly as "less than 1 hour"
 */

// Cutoff is anchored to 28 days following the account migration launch on Sep 2, 2026.
export const MIGRATION_DEADLINE_MS = new Date('2026-09-30T04:29:45Z').getTime()

export function formatMigrationTimeRemaining(msRemaining: number): string {
  if (msRemaining <= 0) {
    return 'less than 1 hour'
  }

  const minutesRemaining = Math.floor(msRemaining / (1000 * 60))
  const hoursRemaining = Math.floor(msRemaining / (1000 * 60 * 60))
  const daysRemaining = Math.floor(msRemaining / (1000 * 60 * 60 * 24))

  // If less than 1 hour (or < 59m), strictly 'less than 1 hour'
  if (hoursRemaining < 1 || minutesRemaining < 60) {
    return 'less than 1 hour'
  }

  // '< 23h59' (between 1h and 23h): hours only, no minutes!
  if (hoursRemaining < 24) {
    return hoursRemaining === 1 ? '1 hour' : `${hoursRemaining} hours`
  }

  // '>= 24h': format in days
  return daysRemaining === 1 ? '1 day' : `${daysRemaining} days`
}

export function getMigrationTimeRemaining(): string {
  const remaining = MIGRATION_DEADLINE_MS - Date.now()
  return formatMigrationTimeRemaining(remaining)
}
