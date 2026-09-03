/**
 * Strongly-typed domain models for the Update Notes Engine.
 *
 * Designed around normalized entities (no monolithic nested blobs),
 * multi-tiered versioning (per-item and global), and zero "any" types.
 * Configured with `| undefined` to strictly satisfy exactOptionalPropertyTypes.
 */

declare const __brand: unique symbol
export type Brand<T, B> = T & { readonly [__brand]: B }

export type ReleaseId = Brand<string, 'ReleaseId'>
export type ItemId = Brand<string, 'ItemId'>

export function asReleaseId(id: string): ReleaseId {
  return id as ReleaseId
}

export function asItemId(id: string): ItemId {
  return id as ItemId
}

export type UpdateTag = 'Balance' | 'New' | 'Fix' | 'Feature' | 'Polish'

export type ReleaseStatus = 'draft' | 'review' | 'published' | 'archived'

export type TargetScopeType = 'game' | 'engine' | 'platform'

export interface TargetScope {
  readonly type: TargetScopeType
  /** Slug of the game or engine (e.g. 'avoid-the-spikes', 'fl-tron-3', 'pong', 'platform') */
  readonly targetId: string
  /** Specific entity, hazard, AI heuristic, or system name */
  readonly entityName?: string | undefined
}

/**
 * Normalized change item.
 * Supports multi-tiered versioning: an item can target a specific game/engine version.
 */
export interface ReleaseItem {
  readonly id: ItemId
  readonly releaseId: ReleaseId
  readonly scope: TargetScope
  readonly tag: UpdateTag
  /** Optional granular version (e.g. '1.2.0' for Avoid, '2.1.0' for Minimax AI) */
  readonly itemVersion?: string | undefined
  readonly subject?: string | undefined
  readonly description: string
  readonly sortOrder: number
  readonly createdAt: number
  readonly updatedAt: number
}

export interface ReleaseAuthor {
  readonly username: string
  readonly nickname?: string | undefined
  readonly pfpUrl?: string | null | undefined
  readonly flags?: number | undefined
  readonly developer?: boolean | undefined
  readonly legacyUser?: boolean | undefined
}

export interface ReleaseMeta {
  readonly id: ReleaseId
  readonly globalVersion: string
  readonly title: string
  /** Short summary displayed in top banners (<= 80 characters) */
  readonly headline: string
  readonly status: ReleaseStatus
  readonly releaseDate: string
  readonly authorUsername?: string | undefined
  readonly author?: ReleaseAuthor | undefined
  readonly publishedAt?: number | undefined
}

export interface DeveloperRationale {
  readonly releaseId: ReleaseId
  readonly content: string
  readonly authorUsername?: string | undefined
}

/**
 * Projection models computed dynamically by ProjectionInterface.
 */
export interface GamePillarProjection {
  readonly gameSlug: string
  readonly gameTitle: string
  readonly items: readonly ReleaseItem[]
}

export interface TagGroupProjection {
  readonly tag: UpdateTag
  readonly items: readonly ReleaseItem[]
}

/**
 * Full composite release projection consumed by UI components.
 */
export interface ReleaseAggregate {
  readonly meta: ReleaseMeta
  readonly rationale?: DeveloperRationale | undefined
  readonly items: readonly ReleaseItem[]
  readonly pillars: readonly GamePillarProjection[]
  readonly tagGroups: readonly TagGroupProjection[]
}

/**
 * Input types for CMS writer interface.
 */
export interface CreateReleaseInput {
  readonly globalVersion: string
  readonly title: string
  readonly headline: string
  readonly releaseDate: string
  readonly authorUsername?: string | undefined
  readonly rationale?: string | undefined
}

export interface UpdateReleaseMetaInput {
  readonly globalVersion?: string | undefined
  readonly title?: string | undefined
  readonly headline?: string | undefined
  readonly releaseDate?: string | undefined
  readonly authorUsername?: string | undefined
  readonly status?: ReleaseStatus | undefined
}

export interface CreateItemInput {
  readonly scope: TargetScope
  readonly tag: UpdateTag
  readonly itemVersion?: string | undefined
  readonly subject?: string | undefined
  readonly description: string
  readonly sortOrder?: number | undefined
}

export interface UpdateItemInput {
  readonly scope?: TargetScope | undefined
  readonly tag?: UpdateTag | undefined
  readonly itemVersion?: string | undefined
  readonly subject?: string | undefined
  readonly description?: string | undefined
  readonly sortOrder?: number | undefined
}