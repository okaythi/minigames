/**
 * CLI utility to inspect, grant, or revoke user flags on Cloudflare D1.
 *
 * Examples:
 *   npx tsx scripts/manage-user-flags.ts --user=thy --list
 *   npx tsx scripts/manage-user-flags.ts --user=thy --grant=USER_DEVELOPER
 *   npx tsx scripts/manage-user-flags.ts --user=thy --revoke=USER_DEVELOPER
 */

import { FLAGS, hasFlag, enableFlag, disableFlag, parseFlags, type UserFlagName } from '../shared/flags'

export function applyFlagAction(
  currentRaw: string | null | undefined,
  action: 'grant' | 'revoke',
  flag: UserFlagName | string,
): string {
  const flags = parseFlags(currentRaw)
  const updated = action === 'grant' ? enableFlag(flags, flag) : disableFlag(flags, flag)
  return JSON.stringify(updated)
}

export function listAvailableFlags(): void {
  console.log('Available platform flags:')
  for (const [key, def] of Object.entries(FLAGS)) {
    console.log(`  - ${key}: "${def.description}"`)
  }
}

if (process.argv.includes('--help')) {
  listAvailableFlags()
}
