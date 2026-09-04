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
let publishedInflight: Promise<readonly ReleaseAggregate[]> | null = null
let draftsInflight: Promise<readonly ReleaseAggregate[]> | null = null

const EMPTY_RELEASES: readonly ReleaseAggregate[] = []
const EMPTY_DRAFTS: readonly ReleaseAggregate[] = []
const localSubscribers = new Set<() => void>()

function notifyLocalSubscribers(): void {
  for (const cb of localSubscribers) {
    cb()
  }
}

function isAdminSurface(): boolean {
  return typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')
}

/**
 * One published release list powers `latest`, `published`, and the TopBanner.
 * Single-flight dedupes concurrent callers (module prime, hooks, StrictMode
 * double-mount) so a page load costs at most ONE /api/updates request.
 */
function loadPublished(force = false): Promise<readonly ReleaseAggregate[]> {
  if (typeof window === 'undefined') return Promise.resolve(EMPTY_RELEASES)
  if (!force && publishedCache !== null) return Promise.resolve(publishedCache)
  if (publishedInflight) return publishedInflight

  publishedInflight = updatesEngine.reader
    .getPublished()
    .then((res) => {
      publishedCache = res
      latestCache = res[0] ?? null
      notifyLocalSubscribers()
      return res
    })
    .finally(() => {
      publishedInflight = null
    })

  return publishedInflight
}

/**
 * Drafts live behind an admin-only endpoint; regular visitors must never pay
 * for them. Loaded lazily on /admin surfaces, shared across all of them.
 */
function loadDrafts(force = false): Promise<readonly ReleaseAggregate[]> {
  if (typeof window === 'undefined') return Promise.resolve(EMPTY_DRAFTS)
  if (!force && draftsCache !== null) return Promise.resolve(draftsCache)
  if (draftsInflight) return draftsInflight

  draftsInflight = updatesEngine.reader
    .getDrafts()
    .then((res) => {
      draftsCache = res
      notifyLocalSubscribers()
      return res
    })
    .finally(() => {
      draftsInflight = null
    })

  return draftsInflight
}

// Prime the caches once per page load.
if (typeof window !== 'undefined') {
  void loadPublished()
  if (isAdminSurface()) void loadDrafts()
}

function subscribeUpdates(callback: () => void): () => void {
  localSubscribers.add(callback)
  const unsubscribeBus = updatesEngine.subscriber.subscribe(() => {
    // CMS writes bust the snapshot caches; only the admin surface refetches drafts.
    void loadPublished(true)
    if (isAdminSurface()) void loadDrafts(true)
  })

  return () => {
    localSubscribers.delete(callback)
    unsubscribeBus()
  }
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
    () => publishedCache ?? EMPTY_RELEASES,
    () => EMPTY_RELEASES,
  )

  useEffect(() => {
    if (publishedCache === null) {
      void loadPublished().finally(() => {
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
 * Reads the shared published snapshot — no separate request.
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
      void loadPublished().finally(() => {
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
    () => draftsCache ?? EMPTY_DRAFTS,
    () => EMPTY_DRAFTS,
  )

  // Drafts are no longer primed for every visitor; ensure the admin editor
  // loads them once on mount (shared + single-flight with other editor parts).
  useEffect(() => {
    void loadDrafts()
  }, [])

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
