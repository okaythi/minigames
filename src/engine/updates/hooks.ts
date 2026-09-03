import { useEffect, useState, useSyncExternalStore } from 'react'
import { updatesEngine } from './engine'
import type {
  CreateItemInput,
  CreateReleaseInput,
  ItemId,
  ReleaseAggregate,
  ReleaseId,
  UpdateItemInput,
  UpdateReleaseMetaInput,
} from './types'

/**
 * React 18 integration hooks for the Update Notes Engine.
 * Built with zero 'any' types and reactive multi-tab cache invalidation.
 */

let publishedCache: readonly ReleaseAggregate[] | null = null
let latestCache: ReleaseAggregate | null = null
let draftsCache: readonly ReleaseAggregate[] | null = null

// Initial fetch to prime synchronous caches
if (typeof window !== 'undefined') {
  void updatesEngine.reader.getPublished().then((res) => {
    publishedCache = res
  })
  void updatesEngine.reader.getLatestPublished().then((res) => {
    latestCache = res
  })
  void updatesEngine.reader.getDrafts().then((res) => {
    draftsCache = res
  })
}

function subscribeUpdates(callback: () => void): () => void {
  return updatesEngine.subscriber.subscribe(() => {
    // Invalidate local in-memory snapshot caches
    void updatesEngine.reader.getPublished().then((res) => {
      publishedCache = res
      callback()
    })
    void updatesEngine.reader.getLatestPublished().then((res) => {
      latestCache = res
      callback()
    })
    void updatesEngine.reader.getDrafts().then((res) => {
      draftsCache = res
      callback()
    })
  })
}

/**
 * Hook for presentation components to query published update notes.
 * Reactive to publish and edit events from the CMS writer interface.
 */
export function usePublishedUpdates(): {
  readonly releases: readonly ReleaseAggregate[]
  readonly loading: boolean
} {
  const [loading, setLoading] = useState(publishedCache === null)

  const releases = useSyncExternalStore(
    subscribeUpdates,
    () => publishedCache ?? [],
    () => [],
  )

  useEffect(() => {
    if (publishedCache === null) {
      void updatesEngine.reader.getPublished().then((res) => {
        publishedCache = res
        setLoading(false)
      })
    } else {
      setLoading(false)
    }
  }, [])

  return { releases, loading }
}

/**
 * Hook specifically optimized for TopBanner to retrieve the latest release.
 */
export function useLatestRelease(): {
  readonly latestRelease: ReleaseAggregate | null
  readonly loading: boolean
} {
  const [loading, setLoading] = useState(latestCache === null)

  const latestRelease = useSyncExternalStore(
    subscribeUpdates,
    () => latestCache,
    () => null,
  )

  useEffect(() => {
    if (latestCache === null) {
      void updatesEngine.reader.getLatestPublished().then((res) => {
        latestCache = res
        setLoading(false)
      })
    } else {
      setLoading(false)
    }
  }, [])

  return { latestRelease, loading }
}

/**
 * Hook exposing the WriterInterface for the incoming CMS / Editor UI.
 * Gives the Editor engineer a plug-and-play controller with live draft state.
 */
export function useUpdateEditor(selectedReleaseId?: ReleaseId): {
  readonly drafts: readonly ReleaseAggregate[]
  readonly activeRelease: ReleaseAggregate | null
  readonly createDraft: (input: CreateReleaseInput) => Promise<ReleaseId>
  readonly updateMeta: (id: ReleaseId, patch: UpdateReleaseMetaInput) => Promise<void>
  readonly setRationale: (id: ReleaseId, content: string, author?: string) => Promise<void>
  readonly addItem: (releaseId: ReleaseId, input: CreateItemInput) => Promise<ItemId>
  readonly updateItem: (itemId: ItemId, patch: UpdateItemInput) => Promise<void>
  readonly removeItem: (itemId: ItemId) => Promise<void>
  readonly reorderItems: (releaseId: ReleaseId, itemIds: readonly ItemId[]) => Promise<void>
  readonly publish: (releaseId: ReleaseId) => Promise<void>
  readonly archive: (releaseId: ReleaseId) => Promise<void>
  readonly deleteDraft: (releaseId: ReleaseId) => Promise<void>
} {
  const drafts = useSyncExternalStore(
    subscribeUpdates,
    () => draftsCache ?? [],
    () => [],
  )

  const [activeRelease, setActiveRelease] = useState<ReleaseAggregate | null>(null)

  useEffect(() => {
    if (!selectedReleaseId) {
      setActiveRelease(null)
      return
    }
    let cancelled = false
    void updatesEngine.reader.getReleaseById(selectedReleaseId).then((rel) => {
      if (!cancelled) {
        setActiveRelease(rel)
      }
    })
    return () => {
      cancelled = true
    }
  }, [selectedReleaseId, drafts])

  return {
    drafts,
    activeRelease,
    createDraft: (input) => updatesEngine.writer.createDraft(input),
    updateMeta: (id, patch) => updatesEngine.writer.updateMeta(id, patch),
    setRationale: (id, content, author) => updatesEngine.writer.setRationale(id, content, author),
    addItem: (releaseId, input) => updatesEngine.writer.addItem(releaseId, input),
    updateItem: (itemId, patch) => updatesEngine.writer.updateItem(itemId, patch),
    removeItem: (itemId) => updatesEngine.writer.removeItem(itemId),
    reorderItems: (releaseId, itemIds) => updatesEngine.writer.reorderItems(releaseId, itemIds),
    publish: (releaseId) => updatesEngine.writer.publish(releaseId),
    archive: (releaseId) => updatesEngine.writer.archive(releaseId),
    deleteDraft: (releaseId) => updatesEngine.writer.deleteDraft(releaseId),
  }
}
