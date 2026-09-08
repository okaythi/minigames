/**
 * Admin Account Seeding Script.
 * Grants STAFF, USERS_ADMIN, GAMES_ADMIN, and PLATFORM_ADMIN flags
 * to accounts 'thy' and 'test' using the canonical enableFlag helper.
 *
 * If an account does not exist in local development, creates a development
 * user and player anchor.
 *
 * Usage:
 *   npx tsx scripts/seed-admin.ts          # defaults to local
 *   npx tsx scripts/seed-admin.ts --local
 *   npx tsx scripts/seed-admin.ts --remote
 */

import { execSync } from 'child_process'
import { UserFlags, enableFlag, parseFlags } from '../shared/flags'
import { nextSnowflake } from '../shared/snowflake'
import { hashPassword } from '../shared/crypto'

const isRemote = process.argv.includes('--remote')
const envFlag = isRemote ? '--remote' : '--local'
const dbName = 'nix-minigames'
const TARGET_ACCOUNTS = ['thy', 'test']

interface UserRow {
  player_id: string
  username: string
  flags: number
}

async function run() {
  console.log(`🛡️ Seeding Admin flags for accounts: ${TARGET_ACCOUNTS.join(', ')} (${envFlag})...`)

  for (const username of TARGET_ACCOUNTS) {
    const query = `SELECT player_id, username, flags FROM users WHERE username = '${username}';`
    let userRow: UserRow | null = null

    try {
      const raw = execSync(
        `npx wrangler d1 execute ${dbName} ${envFlag} --command="${query}" --json`,
        { encoding: 'utf-8' },
      )
      const parsed = JSON.parse(raw)
      userRow = (parsed[0]?.results?.[0] as UserRow) ?? null
    } catch (err: any) {
      console.error(`❌ Failed to query user '${username}':`, err?.message || err)
      continue
    }

    if (userRow) {
      const currentFlags = parseFlags(userRow.flags)
      // §11: Use enableFlag helper to grant STAFF, USERS_ADMIN, GAMES_ADMIN, PLATFORM_ADMIN
      const updatedFlags = enableFlag(
        enableFlag(
          enableFlag(
            enableFlag(currentFlags, UserFlags.STAFF),
            UserFlags.USERS_ADMIN,
          ),
          UserFlags.GAMES_ADMIN,
        ),
        UserFlags.PLATFORM_ADMIN,
      )

      const updateSql = `UPDATE users SET flags = ${updatedFlags} WHERE username = '${username}';`
      execSync(`npx wrangler d1 execute ${dbName} ${envFlag} --command="${updateSql}"`, {
        encoding: 'utf-8',
      })
      console.log(
        `✅ Updated '${username}' (player_id: ${userRow.player_id}): flags ${currentFlags} -> ${updatedFlags}`,
      )
    } else {
      // Create dev user if not exists (helpful for fresh local dev environments)
      console.log(`User '${username}' not found. Creating developer account...`)
      const playerId = crypto.randomUUID()
      const now = Math.floor(Date.now() / 1000)
      const snowflakeId = nextSnowflake(0)
      const { hash, salt } = await hashPassword('password123')

      const initialFlags = enableFlag(
        enableFlag(
          enableFlag(
            enableFlag(UserFlags.NONE, UserFlags.STAFF),
            UserFlags.USERS_ADMIN,
          ),
          UserFlags.GAMES_ADMIN,
        ),
        UserFlags.PLATFORM_ADMIN,
      )

      const createPlayerSql = `INSERT OR IGNORE INTO players (id, first_seen, last_seen, candy) VALUES ('${playerId}', ${now}, ${now}, 100);`
      const createUserSql = `INSERT INTO users (player_id, username, password_hash, password_salt, created_on, last_logged_in, legacy_user, flags, account_locked, snowflake_id) VALUES ('${playerId}', '${username}', '${hash}', '${salt}', ${now}, ${now}, 1, ${initialFlags}, 0, '${snowflakeId}');`

      execSync(
        `npx wrangler d1 execute ${dbName} ${envFlag} --command="${createPlayerSql} ${createUserSql}"`,
        { encoding: 'utf-8' },
      )
      console.log(
        `✅ Created '${username}' (player_id: ${playerId}) with flags ${initialFlags} and default password 'password123'`,
      )
    }
  }

  console.log('🎉 Admin seeding complete!')
}

void run()
