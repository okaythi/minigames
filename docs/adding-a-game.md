# Adding a Game (In-Repo or Separate Repository)

Nixlabs Arcade supports plug-and-play game integration. A game can live either as an in-repo folder under `src/games/<slug>/` or in a **completely separate Git repository** published via NPM or public Git repository URLs.

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
3. Setting `@nixlabs/game-core` as a `peerDependency`.
4. Initializing Git and preparing GitHub CLI commands.
5. Enabling standalone playtesting via `npm run dev` directly in the game repository.

---

## 2. The Game Plugin Contract (`GamePlugin`)

Every game implements the `GamePlugin` interface (`@nixlabs/game-core` or `src/games/plugin-types.ts`):

```ts
export interface GamePlugin {
  /** Manifest: Title, tags, layout, chrome labels, controls, aspect ratio */
  readonly manifest: GameManifest

  /** Engine runtime factory: Wires GameHost, actions, and simulation loop */
  readonly createRuntime?: GameRuntimeFactory | undefined

  /** Optional custom full-page or stage component (e.g. Card-Jitsu Flash/Ruffle stage) */
  readonly Component?: React.ComponentType<Record<string, never>> | undefined

  /** Optional decorator rendered in the stage left sidebar (e.g. Tron Quantum Hologram) */
  readonly renderLeft?: ((snapshot: GameSnapshot) => React.ReactNode) | undefined

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
Games customize their presentation on player profile pages (`/profile/@username`) with zero changes to platform page code:

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
Achievement IDs must follow `${slug}_[a-z0-9_]+` to prevent namespace collisions.

### C. Scoring & Highscore Validation (`scoring`)
Map your game's domain scores to edge leaderboards:
* **Points-based (Avoid the Spikes, Pong)**: Higher integer is better (`score > 0`).
* **Speedrun / Time-Elapsed (FL Tron 3.0)**: Lower elapsed time is better. Winning runs store `score = Math.floor(1000000 - elapsedSeconds * 1000)` and `hasValidScore: (s) => s !== null && s > 1000`.

---

## 4. Single Source of Truth (`shared/game-registry.json`)

To register a game in the main product, add an entry to `shared/game-registry.json`:

```json
[
  {
    "slug": "asteroid-belt",
    "title": "Asteroid Belt",
    "enabled": true,
    "source": { "type": "package", "name": "@nixlabs-games/asteroid-belt" }
  }
]
```

`ALLOWED_SLUGS` in `shared/game-slugs.ts` and Cloudflare Pages edge functions derive automatically from this JSON file.

---

## 5. Connecting a Separate Repo to the Platform

Follow these steps to wire a new standalone game into `minigames`:

### Step 1: Push the Game Repository to GitHub
Create the repository as public using `gh`:
```bash
cd ../game-<slug>
gh repo create game-<slug> --public --source=. --push
```

### Step 2: Add Dependency in `minigames/package.json`
Add the public HTTPS git URL to `dependencies`:
```json
"@nixlabs-games/<slug>": "git+https://github.com/okaythi/game-<slug>.git"
```
> [!IMPORTANT]
> Always use `git+https://` rather than `git+ssh://` so that Cloudflare Pages build runners can fetch the package without requiring private SSH keys.

### Step 3: Synchronize `package-lock.json`
Cloudflare Pages executes `npm clean-install` (`npm ci`), which fails if `package.json` and `package-lock.json` are out of sync:
```bash
npm install --package-lock-only
```
If npm writes `git+ssh:` URLs into `package-lock.json`, ensure they are set to `git+https:`.

### Step 4: Add Path Mappings in `tsconfig.base.json` & `vite.config.ts`
Enable **Dual-Mode Resolution** (local sibling dev with instant hot-reload + CI fallback):

In `tsconfig.base.json`:
```json
"@nixlabs-games/<slug>": [
  "../game-<slug>/src/index.ts",
  "./node_modules/@nixlabs-games/<slug>/src/index.ts"
]
```

In `vite.config.ts`:
```ts
'@nixlabs-games/<slug>': resolveGameEntry('@nixlabs-games/<slug>', '../game-<slug>/src/index.ts'),
```

### Step 5: Register in `src/games/registry.ts`
```ts
import { asteroidBeltPlugin } from '@nixlabs-games/asteroid-belt'

export const PLUGINS: readonly GamePlugin[] = [
  // ...
  asteroidBeltPlugin,
]
```

---

## 6. Build-Time Validation & Safety Guarantees

Before pushing, verify all contracts:

```bash
# 1. Run game contract validator
npm run validate:games

# 2. Run TypeScript build verification
npm run typecheck
```

### Safety & Crash Isolation:
1. **Validation Gate**: Verifies slugs, directory/package structure, manifest fields, cover art, and achievement uniqueness.
2. **Runtime `GameErrorBoundary`**: The game surface is isolated in a React error boundary. If a game crashes or throws during simulation, the main application (header, stats, presence, chat) remains online with an arcade error recovery surface.
3. **Core SDK as Workspace**: Platform contracts and shared engine primitives are packaged in `packages/game-core` and managed as an npm workspace. External game repositories declare `@nixlabs/game-core` as a `peerDependency`.
