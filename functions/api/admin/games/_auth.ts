import { UserFlags } from '../../../../shared/flags'
import {
  requireStaffFlag,
  type StaffAuthResult,
} from '../_shared/require-staff-flag'
import type { StatsEnv } from '../../stats/store-for'

export type GamesAdminAuthResult = StaffAuthResult

export async function requireGamesAdmin(
  request: Request,
  env: StatsEnv & { NIXLABS_DB: D1Database },
): Promise<GamesAdminAuthResult> {
  return requireStaffFlag(request, env, UserFlags.GAMES_ADMIN)
}
