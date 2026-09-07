# Adding a Game (In-Repo or Separate Repository)

Nixlabs Arcade supports plug-and-play game integration. A game can live either as an in-repo folder under `src/games/<slug>/` or in a **completely separate Git repository** published via NPM or Git tags.

A game contributes a manifest, an engine runtime, optional achievement packs, and optional profile card showcase hooks. The main platform handles the shell, HUD, navigation, edge leaderboards, presence, and failure containment.

---

## 1. Fast Track: Scaffold a New Separate Repo

To create an independent game repository ready to plug into the platform:

```bash
npm run game:new <slug>
# Example: npm run game:new asteroid-belt
```

This automates:
1. Creating `../game-<slug>/` with TypeScript, Vite, and the standard Game Plugin boilerplate.
2. Generating `manifest.ts`, `runtime.ts`, `achievements.ts`, `profile-card.tsx`, and `plugin.ts`.
3. Initializing Git and preparing GitHub CLI (`gh repo create`) commands.
4. Enabling standalone playtesting via `npm run dev` directly in the game repository.

---

## 2. The Game Plugin Contract (`GamePlugin`)

Every game (local or external) implements the `GamePlugin` interface (`src/games/plugin-types.ts`):

```ts
export interface GamePlugin {
  /** Manifest: Title, tags, layout, chrome labels, controls, aspect ratio */
  readonly manifest: GameManifest

  /** Engine runtime factory: Wires GameHost, actions, and simulation loop */
  readonly createRuntime?: GameRuntimeFactory | undefined

  /** Optional custom full-page or stage component (e.g. Card-Jitsu Flash/Ruffle stage) */
  readonly Component?: React.ComponentType<Record<string, never>> | undefined

  /** Pluggable Mechanics: Self-contained achievement catalogue */
  readonly achievements?: readonly AchievementDef[] | undefined

  /** Pluggable Mechanics: Custom Player Passport showcase hooks */
  readonly profileCard?: GamePluginProfileCard | undefined

  /** Pluggable Mechanics: Scoring rules and PB validation */
  readonly scoring?: GamePluginScoring | undefined
}
```

---

## 3. Pluggable Product Mechanics

### A. Pluggable Profile Card Showcase (`profileCard`)
Games can customize their presentation on the player profile page (`/profile/@username`) without modifying platform page code:

```tsx
// src/games/<slug>/profile-card.tsx
export const myGameProfileCard: GamePluginProfileCard = {
  // 1. Custom Visual / Avatar slot (e.g. Card-Jitsu penguin avatar or custom sprite)
  renderCover: ({ stat }) => <MyCustomAvatar level={stat?.level} />,

  // 2. Custom Stat Strip Blocks (overrides default Personal Best & World Record)
  getMetrics: ({ stat }) => [
    { label: 'Wave Reached', value: String(stat?.wave ?? 1) },
    { label: 'Alien Slain', value: String(stat?.kills ?? 0) },
  ],

  // 3. Custom Run Count and Action Button Labels
  runsLabel: 'Battles Fought',
  actionLabel: {
    owner: 'Re-enter Arena',
    other: 'Challenge Record',
  },
}
```

### B. Pluggable Achievements (`achievements`)
Games define their own achievements in `achievements.ts`:

```ts
export const myGameAchievements: readonly AchievementDef[] = [
  {
    id: 'mygame_first_strike',
    pillar: 'my-game',
    track: 'Combat',
    name: '🎯 First Strike',
    description: 'Land a hit on a boss hazard.',
    icon: '⚡',
    maxProgress: null,
  },
]
```
Achievement IDs must follow the `${slug}_[a-z0-9_]+` naming pattern to prevent namespace collisions.

### C. Scoring & Highscore Validation (`scoring`)
Map your game's domain scores to edge leaderboards:
* **Points-based (Avoid the Spikes, Pong)**: Higher integer is better (`score > 0`).
* **Speedrun / Time-Elapsed (FL Tron 3.0)**: Lower elapsed time is better. Winning runs store `score = Math.floor(1000000 - elapsedSeconds * 1000)` and `hasValidScore: (s) => s !== null && s > 1000`.

---

## 4. The Single Source of Truth (`shared/game-registry.json`)

To register a game in the main product, add an entry to `shared/game-registry.json`:

```json
[
  {
    "slug": "avoid-the-spikes",
    "title": "Avoid the Spikes!",
    "enabled": true,
    "source": { "type": "local", "path": "./avoid-the-spikes" }
  },
  {
    "slug": "space-invaders",
    "title": "Space Invaders",
    "enabled": true,
    "source": { "type": "package", "name": "@nixlabs-games/space-invaders" }
  }
]
```

`ALLOWED_SLUGS` in `shared/game-slugs.ts` and Cloudflare Pages edge functions derive automatically from this JSON file.

---

## 5. Registering the Plugin in `src/games/registry.ts`

Import your game's plugin into `src/games/registry.ts`:

```ts
import { myGamePlugin } from '@nixlabs-games/my-game' // or './my-game/plugin'

export const PLUGINS: readonly GamePlugin[] = [
  // ...
  myGamePlugin,
]
```

Nothing else in the app needs to be changed. The home grid, search combobox, profile passport, and edge leaderboards automatically configure themselves.

---

## 6. Build-Time Validation & Safety Guarantees

Before deploying, run the automated contract and integrity validator:

```bash
npm run validate:games
```

### Safety & Crash Isolation:
1. **Validation Gate**: Verifies slugs, directory structure, manifest fields, cover art, and achievement uniqueness.
2. **Runtime `GameErrorBoundary`**: The game surface is isolated in a React error boundary. If a third-party or external game crashes or throws during simulation, the main application (header, stats, presence, chat) remains online and displays an arcade error recovery surface.
3. **Developer Mode**: Every engine receives `deps.current.developer: boolean` to enable or disable in-game sandboxes, hit-box debuggers, or telemetry.
