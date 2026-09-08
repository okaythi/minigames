import { UserFlags } from '../../../../shared/flags'
import {
  requireStaffFlag,
  type StaffAuthResult,
} from '../_shared/require-staff-flag'
import type { StatsEnv } from '../../stats/store-for'

export type UsersAdminAuthResult = StaffAuthResult

export async function requireUsersAdmin(
  request: Request,
  env: StatsEnv & { NIXLABS_DB: D1Database },
): Promise<UsersAdminAuthResult> {
  return requireStaffFlag(request, env, UserFlags.USERS_ADMIN)
}
