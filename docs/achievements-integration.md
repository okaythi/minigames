# Nixlabs Games — Achievements & Milestones Integration Guide

This document provides a comprehensive technical reference and integration guide for engineers adding new games, features, or achievement tracks to the Nixlabs Games platform.

---

## 1. Architectural Overview

The Nixlabs Achievements Engine is designed around **strict Separation of Concerns (SoC)**, zero runtime overhead during gameplay simulation, and guaranteed type safety across both frontend browser code and edge Cloudflare Workers.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               1. SHARED DEFINITION LAYER                               │
│  - shared/achievements-protocol.ts : Wire types, AchievementId union, DTOs            │
│  - shared/achievement-defs.ts        : Immutable 80-badge canonical catalogue          │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
           ┌────────────────────────────────┼────────────────────────────────┐
           │                                │                                │
           ▼                                ▼                                ▼
┌──────────────────────┐        ┌──────────────────────┐        ┌────────────────────────┐
│  2. IN-GAME ENGINE   │        │ 3. EVENT BUS & TOAST │        │   4. BACKEND & D1 DB   │
│  - Game loop events  │───────►│  AchievementBus     │───────►│  POST /api/achievem... │
│  - In-session tracker│        │  - Deduplication     │        │  - D1 player_achieve...│
│  - Zero sync network │        │  - In-flight guards  │        │  - Triggers & checks   │
│  - Pure physics/logic│        │  - Bottom Toast Pill │        │  - Evaluator for meta  │
└──────────────────────┘        └──────────────────────┘        └────────────────────────┘
```

### Core Design Rules
1. **Never block the game loop**: Simulation steps (`step(dt)`) must never `await` network requests. Event dispatching through `AchievementBus` is fire-and-forget.
2. **Immutable Catalogue**: All badge metadata (name, description, pillar, track, maxProgress, icon) lives in `shared/achievement-defs.ts`. The database only stores state: `(player_id, id, progress, unlocked_at)`.
3. **No `any` types**: Every achievement ID is a member of the strict `AchievementId` union type.
4. **Permanent High-Water Marks**: Thresholds (e.g. Candy balances, lifetime plays) record if a player has *ever* attained the milestone. Spending candy never revokes an achievement.

---

## 2. The 4 Pillars & Catalogue Hierarchy

The system organizes achievements into a 3-level hierarchy:
1. **Pillars (`AchievementPillar`)**: `platform` | `avoid-the-spikes` | `pong` | `fl-tron-3` (or new game slug)
2. **Tracks (`track: string`)**: Logical group of related milestones (e.g., `"Wall Bounce Milestones"`, `"Rally Volleys"`, `"Candy Vault"`, `"The Box-In"`)
3. **Achievements (`AchievementDef`)**: Up to 4 progressive badges per track (e.g., 10, 20, 50, 100).

```ts
export interface AchievementDef {
  readonly id: AchievementId
  readonly pillar: AchievementPillar
  readonly track: string
  readonly name: string
  readonly description: string
  readonly icon: string
  /** Maximum progress integer; null indicates a binary (one-shot) achievement. */
  readonly maxProgress: number | null
}
```

---

## 3. Step-by-Step Guide: Adding a New Game or Achievement

### Step 1: Register New Achievement IDs
Open `shared/achievements-protocol.ts` and add the string literal to the `AchievementId` type:

```ts
// shared/achievements-protocol.ts
export type AchievementId =
  // Existing badges...
  | 'avoid_wall_tapper'
  // Your new game / feature:
  | 'space_invaders_first_wave'
  | 'space_invaders_mothership_sniper'
```

### Step 2: Define Metadata in the Canonical Catalogue
Open `shared/achievement-defs.ts` and add the badge configuration:

```ts
// shared/achievement-defs.ts
import type { AchievementDef } from './achievements-protocol'

export const ACHIEVEMENT_DEFS: readonly AchievementDef[] = [
  // ...
  {
    id: 'space_invaders_mothership_sniper',
    pillar: 'space-invaders', // Pillar identifier
    track: 'Precision Targeting',
    name: '🎯 Mothership Sniper',
    description: 'Destroy the mystery ship with a single calculated shot in Space Invaders.',
    icon: '🛸',
    maxProgress: null, // Binary milestone
  },
  {
    id: 'space_invaders_alien_sweeper',
    pillar: 'space-invaders',
    track: 'Wave Clear',
    name: '👾 Alien Sweeper',
    description: 'Eliminate 500 total invaders across all matches in Space Invaders.',
    icon: '👾',
    maxProgress: 500, // Incremental progress milestone
  }
]
```

### Step 3: Create an In-Session Achievement Tracker
Create `src/games/<your-game>/achievement-tracker.ts`. The tracker encapsulates per-run and lifetime statistics in isolation from canvas rendering and audio:

```ts
// src/games/space-invaders/achievement-tracker.ts
import type { AchievementBus } from '../../lib/achievement-bus'

export class SpaceInvadersAchievementTracker {
  private waveCount = 0
  private lifetimeKills = 0

  constructor(private readonly bus: AchievementBus) {}

  onMatchStart(): void {
    this.waveCount = 0
  }

  onAlienDestroyed(kind: 'grunt' | 'mothership'): void {
    this.lifetimeKills += 1

    if (kind === 'mothership') {
      this.bus.unlock('space_invaders_mothership_sniper')
    }

    if (this.lifetimeKills >= 500) {
      this.bus.unlock('space_invaders_alien_sweeper', this.lifetimeKills)
    } else {
      this.bus.progress('space_invaders_alien_sweeper', this.lifetimeKills)
    }
  }

  onWaveCleared(): void {
    this.waveCount += 1
    if (this.waveCount >= 1) {
      this.bus.unlock('space_invaders_first_wave')
    }
  }
}
```

### Step 4: Wire Tracker into Game Runtime
Open `src/games/<your-game>/runtime.ts` and instantiate the tracker using `getAchievementBus()`:

```ts
// src/games/space-invaders/runtime.ts
import { getAchievementBus } from '../../lib/achievement-bus'
import { SpaceInvadersAchievementTracker } from './achievement-tracker'

export function createSpaceInvadersRuntime(deps: { readonly current: GameRuntimeDeps }): GameRuntime {
  const tracker = new SpaceInvadersAchievementTracker(getAchievementBus())

  // Pass tracker or callbacks to engine
  const engine = new SpaceInvadersEngine(deps, tracker)

  return {
    // ...
  }
}
```

### Step 5: Update Server-Side Validation List
Open `functions/api/achievements/index.ts` and add the new IDs to `VALID_ACHIEVEMENT_IDS` to ensure the edge API accepts post requests for them:

```ts
// functions/api/achievements/index.ts
const VALID_ACHIEVEMENT_IDS = new Set<string>([
  // ...
  'space_invaders_first_wave',
  'space_invaders_mothership_sniper',
  'space_invaders_alien_sweeper',
])
```

---

## 4. Frontend Notification & Toast System

When any tracker calls `bus.unlock(id)`, the following sequence occurs automatically:

1. **Deduplication**: `AchievementBus` checks its internal `unlocked` set. If already unlocked locally, no API call or duplicate toast is created.
2. **In-Flight Guard**: Prevents concurrent duplicate requests if multiple events fire in milliseconds.
3. **API Sync**: Dispatches `POST /api/achievements` asynchronously.
4. **Toast Queue (`AchievementToast.tsx`)**:
   - The global `<AchievementToast />` pill (mounted in `src/App.tsx`) receives the notification.
   - Slides up from the bottom center (`translateY(0)`).
   - Stays on screen for **5.0 seconds**.
   - Slides smoothly down (`translateY(140%)`).
   - If multiple achievements are earned simultaneously (e.g. crossing two score thresholds in one bounce), they are queued and displayed sequentially.

---

## 5. Database Schema & Persistence

Achievements are stored in Cloudflare D1 via SQLite tables defined in `src/db/schema.ts`:

### `player_achievements` Table
```sql
CREATE TABLE IF NOT EXISTS player_achievements (
  player_id   TEXT    NOT NULL REFERENCES players(id),
  id          TEXT    NOT NULL,
  progress    INTEGER NOT NULL DEFAULT 0,
  unlocked_at INTEGER,             -- Unix epoch seconds (NULL = locked)
  PRIMARY KEY (player_id, id)
);

-- Protects unlocked_at from being reset or overwritten once achieved
CREATE TRIGGER IF NOT EXISTS lock_achievement_unlock
BEFORE UPDATE ON player_achievements
FOR EACH ROW
WHEN OLD.unlocked_at IS NOT NULL AND NEW.unlocked_at IS NULL
BEGIN
  SELECT RAISE(IGNORE);
END;
```

### `player_daily_activity` Table
Tracks daily login and run counts for exact streak calculations:
```sql
CREATE TABLE IF NOT EXISTS player_daily_activity (
  player_id TEXT    NOT NULL REFERENCES players(id),
  utc_day   TEXT    NOT NULL, -- 'YYYY-MM-DD' UTC
  run_count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (player_id, utc_day)
);
```

---

## 6. Local Development & Dev Middleware

The Vite development server (`vite/stats-dev-plugin.ts`) includes an in-memory mock handler for the achievements API:
- Intercepts `GET /api/achievements` and `POST /api/achievements`.
- Automatically tracks unlocks in local memory.
- Feeds all 80 badges into the `/api/users/:username` mock response.

To test locally:
```bash
npm run dev
```

---

## 7. Build & Verification Checklist

Always run the full typecheck and production build before pushing changes:

```bash
# 1. Typecheck across app, functions, and node configs
npm run typecheck

# 2. Verify Vite production bundling
npm run build

# 3. Apply remote D1 migrations (if schema was altered)
npm run db:migrate

# 4. Deploy to Cloudflare Pages
npm run deploy
```
