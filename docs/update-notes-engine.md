# Update Notes Engine Specification & Integration Guide

## 1. System Overview & Philosophy

The Update Notes Engine is a decoupled, Interface-driven release management and changelog orchestration system. It provides plug-and-play interfaces ("the hoses") that allow incoming CMS and Editor UI tools to integrate seamlessly with the minigames arcade platform.

The engine adheres to three core architectural principles:

1. **"Parse, Don't Validate"**: Instead of relying on passive boolean validators, the engine uses functional parsing pipelines that ingest untrusted raw data and transform it into statically guaranteed domain representations (`ParseResult<T>`).
2. **Zero Monolithic Blobs**: Deeply nested release objects are decomposed into discrete, normalized relational entities (`ReleaseMeta`, `ReleaseItem`, `DeveloperRationale`).
3. **Pluggable Interface Registry ("The Hoses")**: All interactions (reading, writing, subscribing, projecting, parsing) are defined through isolated interfaces registered in a central, extensible `InterfaceRegistry`.

```
+-------------------------------------------------------------------------+
|                        CMS / Editor UI Domain                           |
|      (Admin Dashboard, Draft Editor, Item Reordering, Publishing)       |
+------------------------------------+------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                The Interface Registry ("The Hoses")                     |
|                                                                         |
|  * WriterInterface:       createDraft, updateMeta, addItem, publish     |
|  * ReaderInterface:       getPublished, getDrafts, getLatestPublished   |
|  * SubscriberInterface:   subscribe, notify (multi-tab reactive bus)    |
|  * ProjectionInterface:   toGamePillars (by Game), toTagGroups (by Tag) |
|  * ParserInterface:       "Parse, don't validate" type-safe parsers     |
+-------------------+--------------------------------+--------------------+
                    |                                |
                    v                                v
+-----------------------------------+  +----------------------------------+
|      Normalized Data Store        |  |        Frontend Consumers        |
|                                   |  |                                  |
|  - ReleaseMeta (headers & status) |  |  - /updates Page (dual view)     |
|  - ReleaseItem (scoped changes)   |  |  - TopBanner Coordinator         |
|  - DeveloperRationale (notes)     |  |  - Dismissibles Store (<1µs, €0) |
+-----------------------------------+  +----------------------------------+
```

---

## 2. Normalized Domain Entities & Multi-Tiered Versioning

All entities are defined in `src/engine/updates/types.ts`. Monolithic nesting has been completely eliminated.

### Branded Identifiers

```ts
export type ReleaseId = Brand<string, 'ReleaseId'>
export type ItemId = Brand<string, 'ItemId'>
```

### Discrete Normalized Records

```ts
export type UpdateTag = 'Balance' | 'New' | 'Fix' | 'Feature' | 'Polish'
export type ReleaseStatus = 'draft' | 'review' | 'published' | 'archived'
export type TargetScopeType = 'game' | 'engine' | 'platform'

export interface TargetScope {
  readonly type: TargetScopeType
  readonly targetId: string // e.g. 'avoid-the-spikes', 'fl-tron-3', 'platform'
  readonly entityName?: string | undefined // e.g. 'Red Movers', 'Voronoi AI'
}

/**
 * Normalized change item.
 * Supports multi-tiered versioning: each item can declare its own version.
 */
export interface ReleaseItem {
  readonly id: ItemId
  readonly releaseId: ReleaseId
  readonly scope: TargetScope
  readonly tag: UpdateTag
  readonly itemVersion?: string | undefined // e.g. '1.2.0' for Avoid, '2.1.0' for AI
  readonly subject?: string | undefined
  readonly description: string
  readonly sortOrder: number
  readonly createdAt: number
  readonly updatedAt: number
}

export interface ReleaseMeta {
  readonly id: ReleaseId
  readonly globalVersion: string // e.g. '0.2.0'
  readonly title: string
  readonly headline: string // Max 80 characters for top banner CTA
  readonly status: ReleaseStatus
  readonly releaseDate: string
  readonly authorUsername?: string | undefined
  readonly publishedAt?: number | undefined
}

export interface DeveloperRationale {
  readonly releaseId: ReleaseId
  readonly content: string
  readonly authorUsername?: string | undefined
}
```

---

## 3. "Parse, Don't Validate" Engine (`parser.ts`)

In compliance with functional domain modeling principles, the engine rejects loose validation flags. Unstructured payloads from external CMS forms or API requests must pass through functional parsers that produce guaranteed, typed outputs:

```ts
export type ParseResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly errors: readonly string[] }
```

### Parser Invariants Enforced at Ingestion:
1. `parseUpdateTag(raw)`: Strictly enforces `'Balance' | 'New' | 'Fix' | 'Feature' | 'Polish'`. Rejects generic or artificial tags (e.g. `'audio'`).
2. `parseCreateReleaseInput(raw)`: Verifies required metadata fields and enforces `headline.length <= 80`.
3. `parseCreateItemInput(raw)`: Ensures non-empty descriptions, parses `TargetScope`, and preserves granular `itemVersion` when present.
4. `parseReleaseStatus(raw)`: Restricts state transitions to `'draft' | 'review' | 'published' | 'archived'`.

---

## 4. The Core Interfaces ("The Hoses")

Located in `src/engine/updates/interfaces.ts`:

### `ReaderInterface`
```ts
export interface ReaderInterface {
  getPublished(): Promise<readonly ReleaseAggregate[]>
  getDrafts(): Promise<readonly ReleaseAggregate[]>
  getLatestPublished(): Promise<ReleaseAggregate | null>
  getReleaseById(id: ReleaseId): Promise<ReleaseAggregate | null>
  getItemsByScope(scopeType: TargetScopeType, targetId?: string): Promise<readonly ReleaseItem[]>
}
```

### `WriterInterface` (Primary CMS Hose)
```ts
export interface WriterInterface {
  createDraft(input: CreateReleaseInput): Promise<ReleaseId>
  updateMeta(id: ReleaseId, patch: UpdateReleaseMetaInput): Promise<void>
  setRationale(id: ReleaseId, content: string, authorUsername?: string): Promise<void>
  addItem(releaseId: ReleaseId, input: CreateItemInput): Promise<ItemId>
  updateItem(itemId: ItemId, patch: UpdateItemInput): Promise<void>
  removeItem(itemId: ItemId): Promise<void>
  reorderItems(releaseId: ReleaseId, orderedItemIds: readonly ItemId[]): Promise<void>
  publish(releaseId: ReleaseId): Promise<void>
  archive(releaseId: ReleaseId): Promise<void>
  deleteDraft(releaseId: ReleaseId): Promise<void>
}
```

### `SubscriberInterface`
```ts
export interface SubscriberInterface {
  subscribe(listener: () => void): () => void
  notify(): void
}
```

### `ProjectionInterface` (Dual Grouping)
Computes derived views on the fly from normalized items:
- **Game Pillars View**: `toGamePillars(items)` groups by game slug (`Avoid the Spikes!`, `FL Tron 3.0`, `Pong`, `Platform`).
- **Tag Groups View**: `toTagGroups(items)` groups cross-cutting changes by tag (`Balance`, `New`, `Fix`, etc.).

---

## 5. Interface Registry & Extensibility

The engine includes a type-safe `InterfaceRegistry` in `src/engine/updates/registry.ts`.
Adding new interfaces in the future (e.g. `auditLogger`, `moderationHose`, `exportHose`) requires zero architectural refactoring:

```ts
import { updatesEngine } from '../engine/updates'

// Registering a custom interface
updatesEngine.registry.register('auditLogger', {
  logAction: (action: string, releaseId: string) => {
    console.log(`[Audit] ${action} on ${releaseId}`)
  },
})

// Retrieving with strict typing (no 'any')
interface AuditLogger {
  logAction(action: string, releaseId: string): void
}
const logger = updatesEngine.registry.get<AuditLogger>('auditLogger')
```

---

## 6. How the CMS / Editor Engineer Plugs In

An engineer building the CMS or authoring dashboard has two seamless options:

### Option A: Using the React Hook (`useUpdateEditor`)

```tsx
import { useUpdateEditor } from '../engine/updates'

export function CMSEditor() {
  const {
    drafts,
    activeRelease,
    createDraft,
    addItem,
    reorderItems,
    publish,
  } = useUpdateEditor()

  const handleCreate = async () => {
    const draftId = await createDraft({
      globalVersion: '0.3.0',
      title: 'October Balance & Mechanics Patch',
      headline: 'Dissolving teeth balance tuning and Voronoi heuristics',
      releaseDate: 'October 15, 2026',
      rationale: 'Addressing high-tier minimax aggression in FL Tron.',
    })

    await addItem(draftId, {
      scope: { type: 'game', targetId: 'avoid-the-spikes', entityName: 'Red Movers' },
      tag: 'Balance',
      itemVersion: '1.2.0',
      subject: 'Despawn Buffer',
      description: 'Increased candy dissolve buffer window from 1.5s to 2.2s.',
    })

    await publish(draftId)
  }

  return (
    <div>
      <button onClick={handleCreate}>Publish New Update</button>
      {drafts.map(d => <div key={d.meta.id}>{d.meta.title}</div>)}
    </div>
  )
}
```

### Option B: Interacting Directly with the Engine Writer

```ts
import { updatesEngine } from '../engine/updates'

// Direct headless CMS usage (e.g. scripts, bots, CLI)
const draftId = await updatesEngine.writer.createDraft(releasePayload)
await updatesEngine.writer.publish(draftId)
// All UI components (TopBanner, /updates) immediately update across tabs!
```

---

## 7. Data Fed Into Main Game Engines

- **Direct Data Fed into Game Engines**: **Zero.**
- **Architectural Separation**:
  - Canvas loop engines (`AvoidSession`, `PongEngine`, `TronEngine`) consume purely isolated parameters through their local `config.ts` and `GameRuntimeDeps`.
  - Update Notes data is purely descriptive and informational.
  - **Fault Isolation Guarantee**: No CMS authoring error, malformed description, or schema migration can crash a game session, desync physics loops, or impact canvas render performance.