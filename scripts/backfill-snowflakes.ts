/**
 * Retroactive Snowflake ID backfill batch script.
 * Assigns monotonic 64-bit snowflake IDs to existing users missing one.
 *
 * Usage:
 *   npx tsx scripts/backfill-snowflakes.ts          # defaults to local
 *   npx tsx scripts/backfill-snowflakes.ts --local
 *   npx tsx scripts/backfill-snowflakes.ts --remote
 */

import { execSync } from 'child_process'
import { SNOWFLAKE_EPOCH_MS } from '../shared/snowflake'

const isRemote = process.argv.includes('--remote')
const envFlag = isRemote ? '--remote' : '--local'
const dbName = 'nix-minigames'
const LEGACY_CREATOR_ID = 1 // 'legacy_import' in creator_registry

interface UserRow {
  player_id: string
  created_on: number
}

async function run() {
  console.log(`❄️ Starting Snowflake backfill (${envFlag})...`)
  const selectQuery = `SELECT player_id, created_on FROM users WHERE snowflake_id IS NULL ORDER BY created_on ASC;`
  
  let rows: UserRow[] = []
  try {
    const raw = execSync(
      `npx wrangler d1 execute ${dbName} ${envFlag} --command="${selectQuery}" --json`,
      { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 },
    )
    const parsed = JSON.parse(raw)
    rows = (parsed[0]?.results || []) as UserRow[]
  } catch (err: any) {
    console.error('❌ Failed to query existing users:', err?.message || err)
    process.exit(1)
  }

  console.log(`Found ${rows.length} users needing snowflake IDs.`)
  if (rows.length === 0) {
    console.log('✅ All users already have snowflake IDs!')
    return
  }

  let virtualMs = 0n
  let sequence = 0n
  const updates: Array<{ playerId: string; snowflakeId: string }> = []

  for (const u of rows) {
    const userCreatedAtMs = BigInt(
      u.created_on > 10_000_000_000 ? u.created_on : u.created_on * 1000,
    )
    const realDelta = userCreatedAtMs - BigInt(SNOWFLAKE_EPOCH_MS)
    if (realDelta > virtualMs) {
      virtualMs = realDelta
    }

    sequence += 1n
    if (sequence > 4095n) {
      virtualMs += 1n
      sequence = 0n
    }

    const id = (virtualMs << 22n) | (BigInt(LEGACY_CREATOR_ID) << 12n) | sequence
    const padded = id.toString().padStart(19, '0')
    updates.push({ playerId: u.player_id, snowflakeId: padded })
  }

  console.log(`Applying ${updates.length} updates in batches...`)
  const BATCH_SIZE = 50
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE)
    const statements = batch
      .map(
        (u) =>
          `UPDATE users SET snowflake_id = '${u.snowflakeId}' WHERE player_id = '${u.playerId}';`,
      )
      .join(' ')

    execSync(
      `npx wrangler d1 execute ${dbName} ${envFlag} --command="${statements}"`,
      { encoding: 'utf-8' },
    )
    console.log(`  Processed ${Math.min(i + BATCH_SIZE, updates.length)} / ${updates.length}`)
  }

  console.log('✅ Snowflake backfill completed successfully!')
}

void run()
