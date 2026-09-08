import { UserFlags } from '../../../../shared/flags'
import {
  requireStaffFlag,
  type StaffAuthResult,
} from '../_shared/require-staff-flag'
import type { StatsEnv } from '../../stats/store-for'

export type PlatformAdminAuthResult = StaffAuthResult

export async function requirePlatformAdmin(
  request: Request,
  env: StatsEnv & { NIXLABS_DB: D1Database },
): Promise<PlatformAdminAuthResult> {
  return requireStaffFlag(request, env, UserFlags.PLATFORM_ADMIN)
}
