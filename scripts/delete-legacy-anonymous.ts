import { execSync } from 'child_process'

const isRemote = process.argv.includes('--remote')

// 1. Calculate how many legacy anonymous users are inactive (older than 28 days) and not registered
const cutoff = Math.floor(Date.now() / 1000) - (28 * 24 * 60 * 60)
console.log(`Cutoff timestamp: ${cutoff}`)

// Query to get the count
const countQuery = `SELECT COUNT(*) as count FROM players WHERE id NOT IN (SELECT player_id FROM users) AND last_seen < ${cutoff};`
const envFlag = isRemote ? '--remote' : '--local'
const dbName = 'nix-minigames'

try {
  console.log('Fetching count of anonymous users to delete...')
  const resultStr = execSync(`npx wrangler d1 execute ${dbName} ${envFlag} --command="${countQuery}" --json`, { encoding: 'utf-8' })
  const result = JSON.parse(resultStr)
  const count = result[0].results[0].count

  console.log(`Found ${count} anonymous players to delete.`)

  if (count > 0) {
    // 2. Add count to historical_anonymous_users
    console.log('Updating historical_anonymous_users...')
    const updateConfig = `
      INSERT INTO system_config (key, value) VALUES ('historical_anonymous_users', ${count})
      ON CONFLICT(key) DO UPDATE SET value = value + ${count};
    `
    execSync(`npx wrangler d1 execute ${dbName} ${envFlag} --command="${updateConfig}"`)

    // 3. Delete the rows
    console.log('Deleting anonymous players...')
    const deleteQuery = `DELETE FROM players WHERE id NOT IN (SELECT player_id FROM users) AND last_seen < ${cutoff};`
    execSync(`npx wrangler d1 execute ${dbName} ${envFlag} --command="${deleteQuery}"`)
  }

  console.log('Migration complete.')
} catch (e) {
  console.error('Migration failed:', e)
}
