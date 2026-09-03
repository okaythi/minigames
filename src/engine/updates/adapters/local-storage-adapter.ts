import type { ReaderInterface, SubscriberInterface, WriterInterface } from '../interfaces'
import type {
  CreateItemInput,
  CreateReleaseInput,
  DeveloperRationale,
  ItemId,
  ReleaseAggregate,
  ReleaseId,
  ReleaseItem,
  ReleaseMeta,
  TargetScopeType,
  UpdateItemInput,
  UpdateReleaseMetaInput,
} from '../types'
import { asItemId, asReleaseId } from '../types'
import { defaultProjections } from '../projections'
import { localStore, onLocalStorageChange } from '../../../services/storage/local-store'

interface StorageState {
  readonly releases: Record<string, ReleaseMeta>
  readonly rationales: Record<string, DeveloperRationale>
  readonly items: Record<string, ReleaseItem>
}

const STORAGE_KEY = 'nx_updates_engine_v1'

function getInitialState(): StorageState {
  return localStore.read<StorageState>(STORAGE_KEY, {
    releases: {},
    rationales: {},
    items: {},
  })
}

/**
 * Enterprise local storage adapter with cross-tab reactive synchronization.
 * Serves as an instant testing sandbox for the CMS/Editor engineer.
 */
export class LocalStorageAdapter implements ReaderInterface, WriterInterface {
  private state: StorageState
  private readonly subscriber: SubscriberInterface

  public constructor(subscriber: SubscriberInterface) {
    this.subscriber = subscriber
    this.state = getInitialState()

    if (typeof window !== 'undefined') {
      onLocalStorageChange(STORAGE_KEY, () => {
        this.state = getInitialState()
        this.subscriber.notify()
      })
    }
  }

  private persist(nextState: StorageState): void {
    this.state = nextState
    localStore.write(STORAGE_KEY, nextState)
    this.subscriber.notify()
  }

  // --- ReaderInterface ---

  public async getPublished(): Promise<readonly ReleaseAggregate[]> {
    const published = Object.values(this.state.releases).filter(
      (r) => r.status === 'published',
    )
    return this.buildAggregates(published)
  }

  public async getDrafts(): Promise<readonly ReleaseAggregate[]> {
    return this.buildAggregates(Object.values(this.state.releases))
  }

  public async getLatestPublished(): Promise<ReleaseAggregate | null> {
    const published = await this.getPublished()
    return published[0] ?? null
  }

  public async getReleaseById(id: ReleaseId): Promise<ReleaseAggregate | null> {
    const meta = this.state.releases[id]
    if (!meta) return null
    return this.buildAggregate(meta)
  }

  public async getItemsByScope(
    scopeType: TargetScopeType,
    targetId?: string,
  ): Promise<readonly ReleaseItem[]> {
    return Object.values(this.state.items).filter((item) => {
      if (item.scope.type !== scopeType) return false
      if (targetId && item.scope.targetId !== targetId) return false
      return true
    })
  }

  // --- WriterInterface ---

  public async createDraft(input: CreateReleaseInput): Promise<ReleaseId> {
    const id = asReleaseId(`rel_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`)

    const meta: ReleaseMeta = {
      id,
      globalVersion: input.globalVersion,
      title: input.title,
      headline: input.headline,
      status: 'draft',
      releaseDate: input.releaseDate,
      authorUsername: input.authorUsername,
    }

    const nextReleases = { ...this.state.releases, [id]: meta }
    let nextRationales = this.state.rationales

    if (input.rationale) {
      const rat: DeveloperRationale = {
        releaseId: id,
        content: input.rationale,
        authorUsername: input.authorUsername,
      }
      nextRationales = { ...nextRationales, [id]: rat }
    }

    this.persist({
      ...this.state,
      releases: nextReleases,
      rationales: nextRationales,
    })

    return id
  }

  public async updateMeta(id: ReleaseId, patch: UpdateReleaseMetaInput): Promise<void> {
    const existing = this.state.releases[id]
    if (!existing) {
      throw new Error(`Release not found: ${id}`)
    }

    const updated: ReleaseMeta = {
      ...existing,
      ...(patch.globalVersion !== undefined && { globalVersion: patch.globalVersion }),
      ...(patch.title !== undefined && { title: patch.title }),
      ...(patch.headline !== undefined && { headline: patch.headline }),
      ...(patch.releaseDate !== undefined && { releaseDate: patch.releaseDate }),
      ...(patch.authorUsername !== undefined && { authorUsername: patch.authorUsername }),
      ...(patch.status !== undefined && { status: patch.status }),
    }

    this.persist({
      ...this.state,
      releases: { ...this.state.releases, [id]: updated },
    })
  }

  public async setRationale(
    id: ReleaseId,
    content: string,
    authorUsername?: string,
  ): Promise<void> {
    const rat: DeveloperRationale = {
      releaseId: id,
      content,
      authorUsername,
    }

    this.persist({
      ...this.state,
      rationales: { ...this.state.rationales, [id]: rat },
    })
  }

  public async addItem(releaseId: ReleaseId, input: CreateItemInput): Promise<ItemId> {
    const existingRelease = this.state.releases[releaseId]
    if (!existingRelease) {
      throw new Error(`Release not found: ${releaseId}`)
    }

    const itemId = asItemId(`item_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`)
    const itemsForRelease = Object.values(this.state.items).filter(
      (it) => it.releaseId === releaseId,
    )
    const nextOrder = input.sortOrder ?? itemsForRelease.length + 1

    const newItem: ReleaseItem = {
      id: itemId,
      releaseId,
      scope: input.scope,
      tag: input.tag,
      itemVersion: input.itemVersion,
      subject: input.subject,
      description: input.description,
      sortOrder: nextOrder,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    this.persist({
      ...this.state,
      items: { ...this.state.items, [itemId]: newItem },
    })

    return itemId
  }

  public async updateItem(itemId: ItemId, patch: UpdateItemInput): Promise<void> {
    const existing = this.state.items[itemId]
    if (!existing) {
      throw new Error(`Item not found: ${itemId}`)
    }

    const updated: ReleaseItem = {
      ...existing,
      ...(patch.scope !== undefined && { scope: patch.scope }),
      ...(patch.tag !== undefined && { tag: patch.tag }),
      ...(patch.itemVersion !== undefined && { itemVersion: patch.itemVersion }),
      ...(patch.subject !== undefined && { subject: patch.subject }),
      ...(patch.description !== undefined && { description: patch.description }),
      ...(patch.sortOrder !== undefined && { sortOrder: patch.sortOrder }),
      updatedAt: Date.now(),
    }

    this.persist({
      ...this.state,
      items: { ...this.state.items, [itemId]: updated },
    })
  }

  public async removeItem(itemId: ItemId): Promise<void> {
    if (!(itemId in this.state.items)) return
    const nextItems = { ...this.state.items }
    delete nextItems[itemId]

    this.persist({
      ...this.state,
      items: nextItems,
    })
  }

  public async reorderItems(
    releaseId: ReleaseId,
    orderedItemIds: readonly ItemId[],
  ): Promise<void> {
    const nextItems = { ...this.state.items }
    orderedItemIds.forEach((itemId, idx) => {
      const item = nextItems[itemId]
      if (item && item.releaseId === releaseId) {
        nextItems[itemId] = { ...item, sortOrder: idx + 1, updatedAt: Date.now() }
      }
    })

    this.persist({
      ...this.state,
      items: nextItems,
    })
  }

  public async publish(releaseId: ReleaseId): Promise<void> {
    const release = this.state.releases[releaseId]
    if (!release) {
      throw new Error(`Release not found: ${releaseId}`)
    }

    const published: ReleaseMeta = {
      ...release,
      status: 'published',
      publishedAt: Date.now(),
    }

    this.persist({
      ...this.state,
      releases: { ...this.state.releases, [releaseId]: published },
    })
  }

  public async archive(releaseId: ReleaseId): Promise<void> {
    const release = this.state.releases[releaseId]
    if (!release) {
      throw new Error(`Release not found: ${releaseId}`)
    }

    const archived: ReleaseMeta = {
      ...release,
      status: 'archived',
    }

    this.persist({
      ...this.state,
      releases: { ...this.state.releases, [releaseId]: archived },
    })
  }

  public async deleteDraft(releaseId: ReleaseId): Promise<void> {
    const release = this.state.releases[releaseId]
    if (!release) return
    if (release.status === 'published') {
      throw new Error(`Cannot delete published release ${releaseId}. Archive it instead.`)
    }

    const nextReleases = { ...this.state.releases }
    delete nextReleases[releaseId]

    const nextRationales = { ...this.state.rationales }
    delete nextRationales[releaseId]

    const nextItems = { ...this.state.items }
    for (const [id, item] of Object.entries(nextItems)) {
      if (item.releaseId === releaseId) {
        delete nextItems[id]
      }
    }

    this.persist({
      releases: nextReleases,
      rationales: nextRationales,
      items: nextItems,
    })
  }

  // --- Helper Methods ---

  private buildAggregate(meta: ReleaseMeta): ReleaseAggregate {
    const releaseItems = Object.values(this.state.items)
      .filter((it) => it.releaseId === meta.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)

    const rationale = this.state.rationales[meta.id]
    return defaultProjections.toAggregate(meta, releaseItems, rationale)
  }

  private buildAggregates(releases: readonly ReleaseMeta[]): readonly ReleaseAggregate[] {
    return [...releases]
      .sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0))
      .map((rel) => this.buildAggregate(rel))
  }
}