# Adding a game

A game is a folder. The site discovers it through one registry line; nothing else changes.

**A game never ships a custom page component.** The page around the canvas - readout panel, overlay cards,
pause on scroll-away, mute, the stats round trip - is drawn once, in `src/games/template/`, for
every game. A folder contributes an engine, a manifest of strings, and one function that builds
the runtime. That is what keeps all games looking like one cohesive platform.

## 1. Create the folder

```
src/games/<slug>/
  index.tsx         exports default React component: <GameTemplate game={{ manifest, createRuntime }} />
  manifest.ts       every word the chrome shows, plus the card and page copy
  state.ts          the engine's own immutable snapshot
  view-model.ts     state.ts -> the shared GameSnapshot (tiles, badges, run summary, formatters)
  runtime.ts        builds the engine, owns audio/random, exposes the five actions
  create-<slug>-game.ts attaches the GameHost, canvas layers, rAF loop, input listeners
  cover.jpg         3:4 portrait card and game-stage cover art
  banner.jpg        21:8 wide hero banner art for the top of the game page
  engine/           the simulation (grid, physics, AI veto engines, procedural audio)
  render/           canvas layers (renderer, layout transform, particles, hud, menus)
```

`<slug>` is kebab-case and becomes the URL (`/games/<slug>`) and the localStorage/stats key, so
pick it once and keep it.

## 2. Write the manifest

```ts
import cover from './cover.jpg'
import banner from './banner.jpg'
import type { GameManifest } from '../types'
import { formatMyScore } from './view-model'

export const MY_SLUG = 'my-game' as const

export const myGameManifest: GameManifest = {
  slug: MY_SLUG,
  title: 'My Game',
  tagline: 'One line for the card.',
  description: 'A short paragraph for the game page.',
  status: 'playable', // 'playable' | 'prototype' | 'coming-soon'
  accent: 'orange', // 'orange' | 'amber' | 'blue' | 'green' | 'red'
  tags: ['arcade', 'retro', 'canvas'],
  cover, // 3:4 portrait image
  banner, // 21:8 wide hero banner image
  controls: [{ input: 'Click / Space', action: 'Do the thing' }],
  mechanics: [{ title: 'The hook', body: 'Why it works.' }],
  year: 2026,

  // Copy for the shared chrome - the only way a game can talk about its own page.
  aspect: 3 / 4, // canvas box: width / height
  scoreLabel: 'Clear Time', // e.g. 'Points', 'Bounces', 'Clear Time'
  formatScore: formatMyScore, // optional: custom formatter for time (mm:ss:ms) or units across cards/HUD/stats
  bonusLabel: 'Turbos', // e.g. 'Candy', 'Turbos', 'Coins'
  runDurationLabel: 'Clear Time', // optional label for run duration in game-over card
  primaryLabel: 'Play', // label on the primary button
  scoringNote: 'How score and records are calculated.',
  startLine: 'Click, tap or hit Space.',
  intro: 'Two sentences on the start card.',
  pauseNote: 'One line on the pause card.',
  tip: 'One line at the bottom of the readout.',
  legend: [
    { swatch: 'blue', text: 'player object' },
    { swatch: 'orange', text: 'hazard or AI' },
  ],
}
```

The grid, search bar, card, and game page are all driven off this object. Titles are
matched with a fuzzy matcher over `title`, `tags`, and `slug`, so no search registration is needed.

The template renders exactly what a game publishes (`src/games/template/snapshot.ts`):

```ts
interface GameSnapshot {
  status: 'ready' | 'running' | 'paused' | 'over'
  score: number
  best: number | null
  bonus: number
  tiles: readonly { label: string; value: string; note: string }[] // the readout panel
  badges: readonly string[] // tags under it
  run: { score: number; bonus: number; seconds: number; note: string; isRecord: boolean; beatBestBy: number | null } | null
  muted: boolean
}
```

## 3. Scoring & Cloudflare D1 Leaderboards

The backend stores `highscore INTEGER` centrally per game and uses `MAX()` on writes.
Games choose how to map their domain scores into this integer:

- **Point / Bounce Games (e.g. Avoid the Spikes, Pong):**
  Score is raw points/hits. `formatScore` defaults to numeric strings.
- **Speedrun / Time-Elapsed Games (e.g. FL Tron 3.0):**
  Lower elapsed time is better. Winning runs store `score = Math.floor(1000000 - elapsedSeconds * 1000)`.
  Faster runs produce higher integer values, winning runs always beat non-winning runs, and `formatScore` converts `(1000000 - score) / 1000` back to `mm:ss:ms` on all UI surfaces (Card, Header, HUD, and Game Over).

## 4. Start Flow & In-Canvas Menus

Games support two starting styles:

1. **Direct Start (e.g. Avoid the Spikes):**
   Clicking "Start" immediately launches the physics and gameplay.
2. **In-Canvas Start Menu (e.g. FL Tron 3.0):**
   - Engine initializes with `isStarted = false` and `phase = 'menu'`. `toGameSnapshot` returns `status: 'ready'`.
   - When the user clicks "Start" on the page overlay, `engine.start()` sets `isStarted = true` and publishes `status: 'running'`.
   - The page overlay dismisses, revealing the canvas start menu (`drawMainMenu`) where players can view mode cards and instructions.
   - Clicking "START CAMPAIGN" (or pressing Enter/Space) inside the canvas menu calls `engine.startCampaign()` to start the match.

## 5. Export the module & Register

In `src/games/<slug>/index.tsx`:
```tsx
import { GameTemplate } from '../template/game-template'
import { myGameManifest } from './manifest'
import { createMyGameRuntime } from './runtime'

export default function MyGame() {
  return <GameTemplate game={{ manifest: myGameManifest, createRuntime: createMyGameRuntime }} />
}
```

In `src/games/registry.ts`:
```ts
const MyGame = lazy(() => import('./my-game'))

export const GAMES: readonly GameModule[] = [
  // ...
  { manifest: myGameManifest, Component: MyGame },
]
```

In `shared/game-slugs.ts`:
Add `<slug>` to `ALLOWED_SLUGS` so Cloudflare D1 and dev middleware accept stats events for this game.

## 6. The engine contract

React gives the game a `GameHost` (`src/games/runtime/types.ts`):

```ts
const host: GameHost = {
  canvas, context, viewport(), onFrame, onResize, onVisibility,
}
```

`createRuntime(deps)` builds the engine and wires `attach`:
```ts
{
  store: Store<GameSnapshot>,
  actions: { primary, pause, resume, restart, toggleMute },
  attach: (host) => Disposable,
  dispose: () => void,
}
```

Rules that keep a game performant and reliable:

- **Fixed timestep inside, variable outside.** `onFrame` hands a clamped delta; step the simulation via fixed accumulator (`1/120`). Calibrate for high refresh displays (e.g. screen FPS <= 61 targets 58.5 FPS).
- **World units, not screen units.** Simulate in a fixed coordinate box (e.g. 480×640) and use `render/layout.ts` to map coordinates to the canvas with DPR scaling.
- **Two-Layer Veto AI Architecture.** For intelligent NPCs, decouple the **Personality Engine** (what the AI *wants* to do) from the **Survival Engine** (what it is *mathematically allowed* to do via flood-fill safety checks). The Veto system runs every single frame to prevent accidental suicides even when decision timers are slow.
- **No `Math.random()` in core simulation.** Use seeded `Random` from `src/lib/random.ts` for deterministic replays and simulation test suites (`npm run simulate:<game>`).
- **Persistence through services.** Use `useGameStats(slug)` and `deps.current.finishRun(score)`. Never touch raw storage or fetch directly.
- **Separation of Render Layers.** Compose visual systems into isolated modules: arena background, light trails, vehicles/sprites, particles, HUD, and phase menus.

