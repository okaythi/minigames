# Update Notes Engine Specification & Integration Guide

## 1. System Overview

The Update Notes Engine is a decoupled, multi-tier release communication and changelog distribution system. It coordinates four independent architectural layers:

1. **Domain Data Layer (`src/data/updates.ts`)**: Strongly typed schema defining releases, game pillars, categorized change entries, and developer balance rationale.
2. **Presentation Layer (`src/pages/updates-page.tsx`, `src/pages/updates-page.css`)**: Standalone route (`/updates`) with game-specific pillar filtering, developer design callouts, and semantic tagging.
3. **Banner CTA Coordinator (`src/site/top-banner.tsx`)**: Reactive top-level notification bar displaying release announcements, coordinated with the account migration countdown and gated by versioned dismissals.
4. **Storage Layer (`src/services/storage/dismissibles-store.ts`)**: In-memory + `localStorage` reactive store providing zero-cost (€0), sub-microsecond (<1µs) dismissal tracking with cross-tab synchronization.

```
+-------------------------------------------------------------------+
|                        Domain Data Layer                          |
|                     (src/data/updates.ts)                         |
|   UPDATE_RELEASES: readonly UpdateRelease[]                       |
|   LATEST_UPDATE: UpdateRelease (Head entry)                       |
+-------------------+-----------------------------------------------+
                    |
          +---------+---------+
          |                   |
          v                   v
+-------------------+   +-------------------------------------------+
|  Updates Page UI  |   |            Top Banner CTA                 |
|  (/updates route) |   |        (src/site/top-banner.tsx)          |
|                   |   |                                           |
| - Pillar filters  |   | Priority 1: 28d Anonymous Countdown       |
| - Changelogs      |   | Priority 2: Update Notes Announcement CTA |
| - Dev Rationale   |   +---------------------+---------------------+
+-------------------+                         |
                                              | useDismissible('update_notes_cta', { version })
                                              v
                        +-------------------------------------------+
                        |      Enterprise Dismissibles Store        |
                        | (src/services/storage/dismissibles-store) |
                        |                                           |
                        | - React 18 useSyncExternalStore           |
                        | - Cross-tab StorageEvent sync             |
                        | - Version-bound invalidation              |
                        +-------------------------------------------+
```

---

## 2. Core Data Contracts & Types

All data structures are strictly typed in `src/data/updates.ts`:

```ts
export type UpdateTag = 'Balance' | 'New' | 'Fix' | 'Feature' | 'Polish'

export interface UpdateChangeItem {
  readonly tag: UpdateTag
  readonly subject?: string
  readonly description: string
}

export interface UpdateGamePillar {
  readonly gameSlug: string
  readonly gameTitle: string
  readonly changes: readonly UpdateChangeItem[]
}

export interface UpdateRelease {
  readonly version: string
  readonly title: string
  readonly date: string
  readonly headline: string
  readonly developerRationale?: string
  readonly pillars: readonly UpdateGamePillar[]
}
```

### Tag Semantics

| Tag | Purpose | Stylistic Variant |
| :--- | :--- | :--- |
| `Balance` | Numerical tuning, spawn rates, hitbox adjustments, physics constants, EV changes. | Orange/Amber accent (`--nx-orange-tint`) |
| `New` | New modes, enemies, hazards, achievements, or weapons. | Green accent (`rgba(46, 125, 50, 0.12)`) |
| `Fix` | Bug fixes, collision resolution, sound envelope corrections. | Blue accent (`rgba(25, 118, 210, 0.12)`) |
| `Feature` | Platform capabilities (Passports, D1 storage, multi-tier leaderboards). | Purple accent (`rgba(123, 31, 162, 0.12)`) |
| `Polish` | Particle effects, smoothing, visual adjustments, UI feel. | Graphite/Muted accent (`var(--nx-surface-sunken)`) |

---

## 3. Engine Ingestion & Data Flow

### Current Data Inputs

The update notes engine currently consumes data statically exported from `src/data/updates.ts`.
Entries are ordered chronologically with the newest release at index `0`:

- `UPDATE_RELEASES[0]` is canonical `LATEST_UPDATE`.
- `LATEST_UPDATE.version` serves as the invalidation key for `TopBanner`.
- `LATEST_UPDATE.headline` is rendered as the banner CTA text.

### Data Fed Into Game Engines (Separation of Concerns)

Update notes data is **purely informational and diagnostic**. It does **NOT** inject mutable runtime state into active canvas game loops (`AvoidSession`, `PongEngine`, `TronEngine`).

The boundary is maintained as follows:
- **Game Engine Domain**: Reads only from `src/games/<slug>/config.ts` and `GameRuntimeDeps` (`audio`, `random`, `storage`, `stats`, `developer`).
- **Update Engine Domain**: Documents balance adjustments applied to those engine configs.
- **Bi-directional Coupling**: Intentionally zero. A crash or desync in update notes rendering cannot degrade game tick physics or canvas rendering.

---

## 4. How to Plug a System into the Update Notes Engine

### Scenario A: Registering a New Game or Feature Pillar

When adding a game (e.g. `src/games/my-game/`), add its release pillar to the latest release entry:

```ts
// src/data/updates.ts
{
  version: '0.3.0',
  title: 'My Game Launch & System Tuning',
  date: 'October 1, 2026',
  headline: 'Added My Game and balanced hazard speeds',
  developerRationale: 'Explanation of design choices and balance goals.',
  pillars: [
    {
      gameSlug: 'my-game', // Matches manifest.slug
      gameTitle: 'My Game',
      changes: [
        {
          tag: 'New',
          subject: 'Core Loop',
          description: 'Initial public release of My Game.',
        },
      ],
    },
  ],
}
```

The `/updates` page dynamically derives filter buttons from all `pillar.gameSlug` entries present in `UPDATE_RELEASES`. No changes to `UpdatesPage` or its CSS are needed.

### Scenario B: Triggering Top Banner Release Announcements

When a new version is published:
1. Increment `version` in `UPDATE_RELEASES[0]` (e.g. `'0.2.0'` -> `'0.3.0'`).
2. Provide a short `headline` (≤ 80 characters).
3. The `TopBanner` evaluates:
   ```ts
   const [updateDismissed, dismissUpdate] = useDismissible('update_notes_cta', {
     version: LATEST_UPDATE.version,
   })
   ```
4. Because the version changed, `isDismissed` evaluates to `false` for all players across all browsers, regardless of prior dismissals of older versions.
5. When a player clicks the `[✕]` dismiss button on the banner, `dismiss('update_notes_cta', { version: '0.3.0' })` records the dismissal for that specific version only.

### Scenario C: Connecting an External CMS or Admin Editor UI

The engine was architected to transition cleanly from static definitions to dynamic backend storage (e.g., Cloudflare D1 or KV) when the Editor UI is deployed:

```
+-------------------+        +--------------------+        +--------------------+
|  Editor Admin UI  | -----> | POST /api/updates  | -----> | Cloudflare D1 / DB |
+-------------------+        +--------------------+        +---------+----------+
                                                                     |
+-------------------+        +--------------------+                  |
|  Client Browser   | <----- | GET /api/updates   | <----------------+
+---------+---------+        +--------------------+
          |
          v
+-------------------+
|  useUpdates()     | ---> Feed into UpdatesPage & TopBanner
+-------------------+
```

#### Step-by-Step Transition Plan for Editor UI:

1. **Database Schema (`migrations/0006_update_notes.sql`)**:
   ```sql
   CREATE TABLE updates (
     version TEXT PRIMARY KEY,
     title TEXT NOT NULL,
     date TEXT NOT NULL,
     headline TEXT NOT NULL,
     developer_rationale TEXT,
     created_at INTEGER NOT NULL
   );

   CREATE TABLE update_changes (
     id TEXT PRIMARY KEY,
     version TEXT NOT NULL REFERENCES updates(version) ON DELETE CASCADE,
     game_slug TEXT NOT NULL,
     game_title TEXT NOT NULL,
     tag TEXT NOT NULL, -- 'Balance' | 'New' | 'Fix' | 'Feature' | 'Polish'
     subject TEXT,
     description TEXT NOT NULL,
     sort_order INTEGER NOT NULL DEFAULT 0
   );
   ```

2. **Backend Endpoints**:
   - `GET /api/updates`: Returns `readonly UpdateRelease[]` serialized to JSON.
   - `POST /api/updates`: Admin-only endpoint requiring `user.developer === 1` verification.

3. **Client API Service (`src/services/updates-api.ts`)**:
   Replace static import in `UpdatesPage` with a cache-backed reader:
   ```ts
   export async function fetchUpdates(): Promise<readonly UpdateRelease[]> {
     const res = await fetch('/api/updates')
     return res.json()
   }
   ```

4. **Preserved Frontend Contracts**:
   Because `UpdatesPage` and `TopBanner` strictly adhere to `UpdateRelease` and `UpdateTag`, zero UI rewrite is required when switching from static to dynamic data ingestion.

---

## 5. Dismissibles Store Contract Reference

Located in `src/services/storage/dismissibles-store.ts`:

- `useDismissible(id: string, options?: DismissOptions): readonly [boolean, () => void, () => void]`
  - Reactive hook for React components.
  - Return signature: `[isDismissed, dismiss, undismiss]`.
- `isDismissed(id: string, options?: { version?: string }): boolean`
  - Pure synchronous query (<1µs).
- `dismiss(id: string, options?: { version?: string; ttlMs?: number }): void`
  - Persists entry to `localStorage` and emits notify event to active listeners across tabs.
- `undismiss(id: string): void`
  - Clears dismissal record.