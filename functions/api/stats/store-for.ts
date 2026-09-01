import { ALLOWED_SLUGS } from '../../../shared/game-slugs'
import { emptyStatsMemory, statsStoreFrom } from '../../../shared/memory-store'
import type { StatsStore } from '../../../shared/stats-store'
import { d1Store } from './d1-store'

/**
 * Which store a request gets: D1 when the Pages project has the binding,
 * memory when it does not. One function, both routes, so a preview and a
 * production deploy cannot disagree about which one they are talking to.
 */

export interface StatsEnv {
  readonly NIXLABS_DB?: D1Database
}

export const storeFor = (env: StatsEnv): StatsStore =>
  env.NIXLABS_DB === undefined
    ? statsStoreFrom(emptyStatsMemory(ALLOWED_SLUGS), false)
    : d1Store(env.NIXLABS_DB)
