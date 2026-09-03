import type { ReaderInterface, SubscriberInterface, WriterInterface } from '../interfaces'
import type {
  CreateItemInput,
  CreateReleaseInput,
  ItemId,
  ReleaseAggregate,
  ReleaseId,
  ReleaseItem,
  TargetScopeType,
  UpdateItemInput,
  UpdateReleaseMetaInput,
} from '../types'

/**
 * RemoteStorageAdapter connects the Update Notes Engine directly to Cloudflare Pages D1 REST API.
 * Protected by STAFF and CMS_EDITOR flags.
 */
export class RemoteStorageAdapter implements ReaderInterface, WriterInterface {
  public constructor(private readonly subscriber: SubscriberInterface) {}

  // --- ReaderInterface ---

  public async getPublished(): Promise<readonly ReleaseAggregate[]> {
    try {
      const res = await fetch('/api/updates')
      if (!res.ok) return []
      const data = await res.json()
      return (data.releases as ReleaseAggregate[]) ?? []
    } catch {
      return []
    }
  }

  public async getDrafts(): Promise<readonly ReleaseAggregate[]> {
    try {
      const res = await fetch('/api/admin/updates/drafts')
      if (!res.ok) return []
      const data = await res.json()
      return (data.releases as ReleaseAggregate[]) ?? []
    } catch {
      return []
    }
  }

  public async getLatestPublished(): Promise<ReleaseAggregate | null> {
    const published = await this.getPublished()
    return published[0] ?? null
  }

  public async getReleaseById(id: ReleaseId): Promise<ReleaseAggregate | null> {
    try {
      const res = await fetch(`/api/admin/updates/${id}`)
      if (!res.ok) {
        // Fallback check in published list
        const published = await this.getPublished()
        return published.find((r) => r.meta.id === id) ?? null
      }
      const data = await res.json()
      return (data.release as ReleaseAggregate) ?? null
    } catch {
      return null
    }
  }

  public async getItemsByScope(
    scopeType: TargetScopeType,
    targetId?: string,
  ): Promise<readonly ReleaseItem[]> {
    const published = await this.getPublished()
    const matching: ReleaseItem[] = []
    for (const rel of published) {
      for (const item of rel.items) {
        if (item.scope.type === scopeType && (!targetId || item.scope.targetId === targetId)) {
          matching.push(item)
        }
      }
    }
    return matching
  }

  // --- WriterInterface ---

  public async createDraft(input: CreateReleaseInput): Promise<ReleaseId> {
    const res = await fetch('/api/admin/updates/drafts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`[CMS] Failed to create draft: ${err}`)
    }
    const data = await res.json()
    this.subscriber.notify()
    return data.id as ReleaseId
  }

  public async updateMeta(id: ReleaseId, patch: UpdateReleaseMetaInput): Promise<void> {
    const res = await fetch(`/api/admin/updates/${id}/meta`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`[CMS] Failed to update release meta: ${err}`)
    }
    this.subscriber.notify()
  }

  public async setRationale(
    id: ReleaseId,
    content: string,
    authorUsername?: string,
  ): Promise<void> {
    const res = await fetch(`/api/admin/updates/${id}/rationale`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, authorUsername }),
    })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`[CMS] Failed to set rationale: ${err}`)
    }
    this.subscriber.notify()
  }

  public async addItem(releaseId: ReleaseId, input: CreateItemInput): Promise<ItemId> {
    const res = await fetch(`/api/admin/updates/${releaseId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`[CMS] Failed to add item: ${err}`)
    }
    const data = await res.json()
    this.subscriber.notify()
    return data.itemId as ItemId
  }

  public async updateItem(itemId: ItemId, patch: UpdateItemInput): Promise<void> {
    const res = await fetch(`/api/admin/updates/items/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`[CMS] Failed to update item: ${err}`)
    }
    this.subscriber.notify()
  }

  public async removeItem(itemId: ItemId): Promise<void> {
    const res = await fetch(`/api/admin/updates/items/${itemId}`, {
      method: 'DELETE',
    })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`[CMS] Failed to remove item: ${err}`)
    }
    this.subscriber.notify()
  }

  public async reorderItems(
    releaseId: ReleaseId,
    orderedItemIds: readonly ItemId[],
  ): Promise<void> {
    const res = await fetch(`/api/admin/updates/${releaseId}/reorder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderedItemIds }),
    })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`[CMS] Failed to reorder items: ${err}`)
    }
    this.subscriber.notify()
  }

  public async publish(releaseId: ReleaseId): Promise<void> {
    const res = await fetch(`/api/admin/updates/${releaseId}/publish`, {
      method: 'POST',
    })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`[CMS] Failed to publish release: ${err}`)
    }
    this.subscriber.notify()
  }

  public async archive(releaseId: ReleaseId): Promise<void> {
    const res = await fetch(`/api/admin/updates/${releaseId}/archive`, {
      method: 'POST',
    })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`[CMS] Failed to archive release: ${err}`)
    }
    this.subscriber.notify()
  }

  public async deleteDraft(releaseId: ReleaseId): Promise<void> {
    const res = await fetch(`/api/admin/updates/${releaseId}`, {
      method: 'DELETE',
    })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`[CMS] Failed to delete draft: ${err}`)
    }
    this.subscriber.notify()
  }
}
