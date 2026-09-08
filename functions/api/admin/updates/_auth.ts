import { UserFlags } from '../../../../shared/flags'
import {
  requireStaffFlag,
  type StaffAuthResult,
} from '../_shared/require-staff-flag'
import type { StatsEnv } from '../../stats/store-for'

export type CmsAuthResult = StaffAuthResult

/**
 * Update Notes CMS authorization guard — delegating to generalized staff guard.
 */
export async function requireCmsEditor(
  request: Request,
  env: StatsEnv & { NIXLABS_DB: D1Database },
): Promise<CmsAuthResult> {
  return requireStaffFlag(request, env, UserFlags.CMS_EDITOR)
}
