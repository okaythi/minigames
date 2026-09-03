import type {
  CreateItemInput,
  CreateReleaseInput,
  GamePillarProjection,
  ItemId,
  ReleaseAggregate,
  ReleaseId,
  ReleaseItem,
  TagGroupProjection,
  TargetScopeType,
  UpdateItemInput,
  UpdateReleaseMetaInput,
} from './types'
import type { ParseResult } from './parser'

/**
 * The pluggable Interfaces ("The Hoses").
 * Decouples presentation, authoring tools, and storage implementations.
 * Adding a new interface is a matter of defining it here and registering in InterfaceRegistry.
 */

export interface ReaderInterface {
  /** Retrieve all published releases with projections. */
  getPublished(): Promise<readonly ReleaseAggregate[]>
  /** Retrieve all releases and working drafts for CMS authoring with projections. */
  getDrafts(): Promise<readonly ReleaseAggregate[]>
  /** Retrieve the latest published release (consumed by TopBanner). */
  getLatestPublished(): Promise<ReleaseAggregate | null>
  /** Retrieve a single release by its ID. */
  getReleaseById(id: ReleaseId): Promise<ReleaseAggregate | null>
  /** Retrieve items matching a specific scope (e.g. all changes for 'pong'). */
  getItemsByScope(scopeType: TargetScopeType, targetId?: string): Promise<readonly ReleaseItem[]>
}

export interface WriterInterface {
  /** Create a new release draft. */
  createDraft(input: CreateReleaseInput): Promise<ReleaseId>
  /** Update metadata on an existing release. */
  updateMeta(id: ReleaseId, patch: UpdateReleaseMetaInput): Promise<void>
  /** Update developer rationale design notes for a release. */
  setRationale(id: ReleaseId, content: string, authorUsername?: string): Promise<void>
  /** Add a change item to a release. */
  addItem(releaseId: ReleaseId, input: CreateItemInput): Promise<ItemId>
  /** Update an existing change item. */
  updateItem(itemId: ItemId, patch: UpdateItemInput): Promise<void>
  /** Delete a change item. */
  removeItem(itemId: ItemId): Promise<void>
  /** Reorder change items within a release. */
  reorderItems(releaseId: ReleaseId, orderedItemIds: readonly ItemId[]): Promise<void>
  /** Publish a draft release (makes it visible to players and triggers banner). */
  publish(releaseId: ReleaseId): Promise<void>
  /** Archive a release. */
  archive(releaseId: ReleaseId): Promise<void>
  /** Delete an unpublished draft. */
  deleteDraft(releaseId: ReleaseId): Promise<void>
}

export interface SubscriberInterface {
  /** Subscribe to release change events (publish, draft edit, delete). */
  subscribe(listener: () => void): () => void
  /** Broadcast a change event to all active listeners. */
  notify(): void
}

export interface ProjectionInterface {
  /** Group items by game pillar (e.g. Avoid the Spikes, FL Tron 3.0, Pong, Platform). */
  toGamePillars(items: readonly ReleaseItem[]): readonly GamePillarProjection[]
  /** Group items by category tag (e.g. Balance, New, Fix, Feature, Polish). */
  toTagGroups(items: readonly ReleaseItem[]): readonly TagGroupProjection[]
  /** Assemble normalized components into a full ReleaseAggregate. */
  toAggregate(
    meta: ReleaseAggregate['meta'],
    items: readonly ReleaseItem[],
    rationale?: ReleaseAggregate['rationale'],
  ): ReleaseAggregate
}

export interface ParserInterface {
  parseReleaseInput(raw: unknown): ParseResult<CreateReleaseInput>
  parseItemInput(raw: unknown): ParseResult<CreateItemInput>
  parseMetaPatch(raw: unknown): ParseResult<UpdateReleaseMetaInput>
  parseItemPatch(raw: unknown): ParseResult<UpdateItemInput>
}