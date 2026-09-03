/**
 * CLI utility to inspect, grant, or revoke user flags on Cloudflare D1.
 *
 * Examples:
 *   npx tsx scripts/manage-user-flags.ts --user=thy --list
 *   npx tsx scripts/manage-user-flags.ts --user=thy --grant=USER_DEVELOPER
 *   npx tsx scripts/manage-user-flags.ts --user=thy --revoke=USER_DEVELOPER
 */

import { UserFlags, FLAGS_METADATA, hasFlag, enableFlag, disableFlag, parseFlags, type UserFlagsBit } from '../shared/flags'

export function applyFlagAction(
  currentRaw: unknown,
  action: 'grant' | 'revoke',
  flag: UserFlagsBit,
): number {
  const flags = parseFlags(currentRaw)
  return action === 'grant' ? enableFlag(flags, flag) : disableFlag(flags, flag)
}

export function listAvailableFlags(): void {
  console.log('Available platform flags:')
  for (const [bit, meta] of Object.entries(FLAGS_METADATA)) {
    console.log(`  - ${meta.name} (Bit ${bit}): "${meta.description}"`)
  }
}

if (process.argv.includes('--help')) {
  listAvailableFlags()
}
