import type {
  ParserInterface,
  ProjectionInterface,
  ReaderInterface,
  SubscriberInterface,
  WriterInterface,
} from './interfaces'
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
} from './types'
import {
  parseCreateItemInput,
  parseCreateReleaseInput,
  parseUpdateItemInput,
  parseUpdateReleaseMetaInput,
} from './parser'
import { defaultProjections } from './projections'
import { InterfaceRegistry } from './registry'
import { LocalStorageAdapter } from './adapters/local-storage-adapter'
import { StaticSeedAdapter } from './adapters/static-seed-adapter'
import { RemoteStorageAdapter } from './adapters/remote-storage-adapter'


/**
 * Event-bus subscriber implementation.
 */
class EventBusSubscriber implements SubscriberInterface {
  private readonly listeners = new Set<() => void>()

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  public notify(): void {
    for (const listener of this.listeners) {
      listener()
    }
  }
}

/**
 * Validating and parsing writer proxy.
 * Enforces "Parse, don't validate" before passing data to storage adapters.
 */
class ValidatingWriterProxy implements WriterInterface {
  public constructor(private readonly inner: WriterInterface) {}

  public async createDraft(input: CreateReleaseInput): Promise<ReleaseId> {
    const parsed = parseCreateReleaseInput(input)
    if (!parsed.ok) {
      throw new Error(`[WriterInterface] Invalid release input:\n${parsed.errors.join('\n')}`)
    }
    return this.inner.createDraft(parsed.value)
  }

  public async updateMeta(id: ReleaseId, patch: UpdateReleaseMetaInput): Promise<void> {
    const parsed = parseUpdateReleaseMetaInput(patch)
    if (!parsed.ok) {
      throw new Error(`[WriterInterface] Invalid meta patch:\n${parsed.errors.join('\n')}`)
    }
    return this.inner.updateMeta(id, parsed.value)
  }

  public async setRationale(
    id: ReleaseId,
    content: string,
    authorUsername?: string,
  ): Promise<void> {
    if (typeof content !== 'string' || content.trim().length === 0) {
      throw new Error('[WriterInterface] Rationale content must be a non-empty string')
    }
    return this.inner.setRationale(id, content.trim(), authorUsername?.trim())
  }

  public async addItem(releaseId: ReleaseId, input: CreateItemInput): Promise<ItemId> {
    const parsed = parseCreateItemInput(input)
    if (!parsed.ok) {
      throw new Error(`[WriterInterface] Invalid item input:\n${parsed.errors.join('\n')}`)
    }
    return this.inner.addItem(releaseId, parsed.value)
  }

  public async updateItem(itemId: ItemId, patch: UpdateItemInput): Promise<void> {
    const parsed = parseUpdateItemInput(patch)
    if (!parsed.ok) {
      throw new Error(`[WriterInterface] Invalid item patch:\n${parsed.errors.join('\n')}`)
    }
    return this.inner.updateItem(itemId, parsed.value)
  }

  public async removeItem(itemId: ItemId): Promise<void> {
    return this.inner.removeItem(itemId)
  }

  public async reorderItems(
    releaseId: ReleaseId,
    orderedItemIds: readonly ItemId[],
  ): Promise<void> {
    return this.inner.reorderItems(releaseId, orderedItemIds)
  }

  public async publish(releaseId: ReleaseId): Promise<void> {
    return this.inner.publish(releaseId)
  }

  public async archive(releaseId: ReleaseId): Promise<void> {
    return this.inner.archive(releaseId)
  }

  public async deleteDraft(releaseId: ReleaseId): Promise<void> {
    return this.inner.deleteDraft(releaseId)
  }
}

/**
 * Composite reader that merges custom local/CMS releases with static seed data.
 */
class CompositeReader implements ReaderInterface {
  public constructor(
    private readonly local: ReaderInterface,
    private readonly seed: ReaderInterface,
  ) {}

  public async getPublished(): Promise<readonly ReleaseAggregate[]> {
    const [localPublished, seedPublished] = await Promise.all([
      this.local.getPublished(),
      this.seed.getPublished(),
    ])
    // Deduplicate by globalVersion, prioritizing local
    const versions = new Set<string>()
    const combined: ReleaseAggregate[] = []

    for (const rel of localPublished) {
      versions.add(rel.meta.globalVersion)
      combined.push(rel)
    }

    for (const rel of seedPublished) {
      if (!versions.has(rel.meta.globalVersion)) {
        combined.push(rel)
      }
    }

    return combined
  }

  public async getDrafts(): Promise<readonly ReleaseAggregate[]> {
    return this.local.getDrafts()
  }

  public async getLatestPublished(): Promise<ReleaseAggregate | null> {
    const all = await this.getPublished()
    return all[0] ?? null
  }

  public async getReleaseById(id: ReleaseId): Promise<ReleaseAggregate | null> {
    const local = await this.local.getReleaseById(id)
    if (local) return local
    return this.seed.getReleaseById(id)
  }

  public async getItemsByScope(
    scopeType: TargetScopeType,
    targetId?: string,
  ): Promise<readonly ReleaseItem[]> {
    const [localItems, seedItems] = await Promise.all([
      this.local.getItemsByScope(scopeType, targetId),
      this.seed.getItemsByScope(scopeType, targetId),
    ])
    return [...localItems, ...seedItems]
  }
}

/**
 * ParserInterface implementation wrapping parser functions.
 */
const defaultParser: ParserInterface = {
  parseReleaseInput: parseCreateReleaseInput,
  parseItemInput: parseCreateItemInput,
  parseMetaPatch: parseUpdateReleaseMetaInput,
  parseItemPatch: parseUpdateItemInput,
}

/**
 * Core Update Notes Engine orchestrator.
 * Connects the InterfaceRegistry and provides standard accessor properties.
 */
export class UpdateNotesEngine {
  public readonly registry: InterfaceRegistry

  public constructor(customWriter?: WriterInterface, customReader?: ReaderInterface) {
    const subscriber = new EventBusSubscriber()
    const staticSeed = new StaticSeedAdapter()
    const localAdapter = new LocalStorageAdapter(subscriber)
    const remoteAdapter = new RemoteStorageAdapter(subscriber)

    const isBrowser = typeof window !== 'undefined'
    const defaultReader = isBrowser ? remoteAdapter : new CompositeReader(localAdapter, staticSeed)
    const defaultWriter = isBrowser ? remoteAdapter : localAdapter

    const reader = customReader ?? defaultReader
    const writer = new ValidatingWriterProxy(customWriter ?? defaultWriter)

    this.registry = new InterfaceRegistry({
      reader,
      writer,
      subscriber,
      projection: defaultProjections,
      parser: defaultParser,
    })
  }


  public get reader(): ReaderInterface {
    return this.registry.get('reader')
  }

  public get writer(): WriterInterface {
    return this.registry.get('writer')
  }

  public get subscriber(): SubscriberInterface {
    return this.registry.get('subscriber')
  }

  public get projection(): ProjectionInterface {
    return this.registry.get('projection')
  }

  public get parser(): ParserInterface {
    return this.registry.get('parser')
  }
}

/** Canonical engine singleton */
export const updatesEngine = new UpdateNotesEngine()