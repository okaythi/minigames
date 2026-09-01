# Adding a game

A game is a folder. The site discovers it through one registry line; nothing else changes.

**A game never ships a component.** The page around the canvas - readout panel, overlay cards,
pause on scroll-away, mute, the stats round trip - is drawn once, in `src/games/template/`, for
every game. A folder contributes an engine, a manifest of strings, and one function that builds
the runtime. That is what keeps nine games looking like one site.

## 1. Create the folder

```
src/games/<slug>/
  index.ts          exports the GameModule: { manifest, createRuntime }
  manifest.ts       every word the chrome shows, plus the card and page copy
  state.ts          the engine's own immutable snapshot
  view-model.ts     state.ts -> the shared GameSnapshot (tiles, badges, run summary)
  runtime.ts        builds the engine, owns audio/random, exposes the five actions
  cover.jpg         3:2 card art (keep it under ~40 KB)
  engine/           the simulation
  render/           canvas layers
```

`<slug>` is kebab-case and becomes the URL (`/games/<slug>`) and the localStorage/stats key, so
pick it once and keep it.

## 2. Write the manifest

```ts
import cover from './cover.jpg'
import type { GameManifest } from '../types'

export const MY_SLUG = 'my-game' as const

export const myGameManifest: GameManifest = {
  slug: MY_SLUG,
  title: 'My Game',
  tagline: 'One line for the card.',
  description: 'A short paragraph for the game page.',
  status: 'playable', // 'playable' | 'prototype' | 'coming-soon'
  accent: 'green', // 'orange' | 'amber' | 'blue' | 'green' | 'red'
  tags: ['puzzle'],
  cover,
  controls: [{ input: 'Click', action: 'Do the thing' }],
  mechanics: [{ title: 'The hook', body: 'Why it works.' }],
  year: 2026,

  // Copy for the shared chrome - the only way a game can talk about its own page.
  aspect: 3 / 4, // canvas box: width / height
  scoreLabel: 'Points',
  bonusLabel: 'Coins',
  primaryLabel: 'Jump', // label on the primary button while running
  scoringNote: 'One point per ring cleared.',
  startLine: 'Click, tap or hit Space.',
  intro: 'Two sentences on the start card.',
  pauseNote: 'One line on the pause card.',
  tip: 'One line at the bottom of the readout.',
  legend: [{ swatch: 'orange', text: 'the thing you must not touch' }],
}
```

The grid, the search bar, the card and the game page are all driven off this object. Titles are
matched with a fuzzy matcher over `title`, `tags` and `slug`, so no search registration is needed.

The template renders exactly what a game publishes (`src/games/template/snapshot.ts`):

```ts
interface GameSnapshot {
  status: 'ready' | 'running' | 'paused' | 'over'
  score: number
  best: number | null
  bonus: number
  tiles: readonly { label: string; value: string; note: string }[] // the readout panel
  badges: readonly string[] // tags under it
  run: { score; bonus; seconds; note; isRecord; beatBestBy } | null // the game-over card
  muted: boolean
}
```

So a game shows a number on the page by putting it in `tiles`. It never adds markup.

## 3. Export the module

```ts
import type { GameModule } from '../types'
import { myGameManifest } from './manifest'
import { createMyGameRuntime } from './runtime'

export const myGame: GameModule = { manifest: myGameManifest, createRuntime: createMyGameRuntime }
```

`createRuntime(deps)` returns the one object the chrome drives:

```ts
{
  store: Store<GameSnapshot>,                 // what the HUD renders
  actions: { primary, pause, resume, restart, toggleMute },
  attach: (host) => Disposable,               // the canvas layers
  dispose: () => void,                        // audio, listeners, anything else
}
```

`deps` is a live ref, so the engine reads `deps.current.best` when a run starts instead of
capturing a stale value: `{ best, bonus, beginRun(), finishRun(score), bankBonus(amount) }` -
the whole interface between a game and the stats service. Nothing in `engine/` imports React.

## 4. Register it

```ts
// src/games/registry.ts
import { myGame } from './my-game'

export const GAMES: readonly GameModule[] = [avoidTheSpikes, myGame]
```

Then add the slug to `ALLOWED_SLUGS` in `functions/api/stats/index.ts` so the edge is willing to
store counters for it (the function refuses unknown slugs on purpose - otherwise anyone could
mint D1 rows).

## 5. The engine contract

React gives the game a `GameHost` (`src/games/runtime/types.ts`) and nothing else:

```ts
const host: GameHost = {
  canvas, context, viewport(), onFrame, onResize, onVisibility,
}
```

`<GameSurface attach={...} aspect={width / height} label="..." />` owns the canvas element, the
DPR-aware backing store, the resize observer and the rAF loop. `attach` receives the host,
subscribes to whatever it needs and returns a `Disposable`. Teardown is that disposable's only
job: remove listeners, close the AudioContext, stop timers.

Rules that keep a game out of trouble:

- **Fixed timestep inside, variable outside.** `onFrame` hands you a clamped delta; accumulate it
  and step the simulation at a constant rate (`1/120` in Avoid the Spikes). Never integrate on the
  raw delta.
- **World units, not screen units.** Simulate in a fixed box (360×480 here) and let one function -
  `render/layout.ts` - map that box to the canvas. Physics then behave identically on a phone and
  a 27" monitor.
- **The engine does not know React exists.** It publishes an immutable snapshot into a store
  (`src/lib/observable-store.ts`); HUD components subscribe with `useSyncExternalStore`. Push a
  snapshot when a value a human can read changes, not per frame.
- **No `Math.random()` in the simulation.** Take a seeded `Random` from `src/lib/random.ts` so a
  run can be reproduced, and pass an explicit seed in tests.
- **Persistence goes through the service layer.** `src/services/storage/local-store.ts` for the
  browser's own data, `useGameStats(slug)` for plays and scores. Games never touch
  `window.localStorage` directly, and they never fetch.
- **Draw layers, not a Draw Everything file.** One module per visual system: arena, spikes,
  player, fx, and a composer that applies the world transform (and the shake offset) once.

## 6. Check it headlessly

Copy the shape of `scripts/simulate-avoid.ts`: boot the session with a silent audio stub, drive it
with a scripted input, and assert the promises your design makes - scoring is exact, hazards are
lethal, generated levels are solvable, nothing goes `NaN`, the difficulty curve is monotonic. No
browser, no canvas, no DOM. It runs in about half a second and catches the class of bug that is
invisible in a screenshot.
