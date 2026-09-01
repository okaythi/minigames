# Refactoring Master Task List

Tracking every identified monolithic file, monolithic object, separation of concerns violation, lazy typing occurrence, and "AI-screaming" pattern across the codebase.

---

## Phase 1: Shared Core Utilities & Cross-Game Decoupling
- [x] **1.1** Extract `roundRectPath` and `setCanvasFont` from `src/games/avoid-the-spikes/render/draw-utils.ts` into a neutral library module `src/lib/canvas.ts`.
- [x] **1.2** Update `src/games/avoid-the-spikes/render/draw-utils.ts` to re-export from `src/lib/canvas.ts`.
- [x] **1.3** Create generic `src/lib/audio-engine.ts` with `IAudioEngine` interface, synthesizer voices, compressor, and noise buffer scheduler.
- [x] **1.4** Replace duplicated 179-line `audio-engine.ts` in both `src/games/avoid-the-spikes/engine/audio/` and `src/games/pong/engine/audio/` with thin wrappers over `src/lib/audio-engine.ts`.
- [x] **1.5** Decouple `scripts/simulate-avoid.ts` mock from concrete `AudioEngine` by typing against `IAudioEngine`.
- [x] **1.6** Verify with `npm run simulate` and `npx tsc --noEmit`.
- [x] **1.7** Git Commit: `refactor(core): extract shared audio engine and canvas utilities`.

---

## Phase 2: Pong Architecture, Renderer & Engine Modularization
- [x] **2.1** Fix "AI-screaming" hack in `src/games/pong/engine/ai.ts` (`if (xmin > xmax) epsilon = 0 // Silence linter`).
- [x] **2.2** Create `src/games/pong/engine/types.ts` with strict types (`PowerupType`, `AIPowerupType`, `PaddleState`, `PongState`, `Difficulty`, `Mode`, `ActivePowerup`, `CandyItem`, `PongNotification`).
- [x] **2.3** Refactor `src/games/pong/engine/config.ts` (strict types for `activePowerups` and `COSTS`).
- [x] **2.4** Extract `src/games/pong/engine/physics.ts` (paddle movement, pointer lerp, ball physics, wall bounds).
- [x] **2.5** Extract `src/games/pong/engine/collision.ts` (paddle hits, bounce angles, glass wall, scoring).
- [x] **2.6** Extract `src/games/pong/engine/candies.ts` (candy spawn timer, collection math).
- [x] **2.7** Extract `src/games/pong/engine/snapshot.ts` (snapshot view-model builder for Pong).
- [x] **2.8** Refactor `src/games/pong/engine/engine.ts` (slim coordinator composing submodules, fix `toggleMuted`).
- [x] **2.9** Create `src/games/pong/render/types.ts` & `src/games/pong/render/draw-fx.ts` (particle simulation, trails, rings).
- [x] **2.10** Create `src/games/pong/render/draw-arena.ts` (grid, lines, background, backdrop).
- [x] **2.11** Create `src/games/pong/render/draw-paddle.ts` (player/AI paddles, glass wall, ball glow, magnet prompt).
- [x] **2.12** Create `src/games/pong/render/draw-powerups.ts` (powerup icons vector paths, spark timer meters).
- [x] **2.13** Create `src/games/pong/render/draw-menus.ts` (config panel, choices, loadout shop panel, buttons).
- [x] **2.14** Create `src/games/pong/create-pong-game.ts` (input handling, pointer coords, lifecycle management).
- [x] **2.15** Refactor `src/games/pong/render/render.ts` (slim frame coordinator, eliminate Avoid The Spikes import, eliminate typecasts).
- [x] **2.16** Update `src/games/pong/runtime.ts` and `src/games/pong/index.tsx` to use `create-pong-game.ts`.
- [x] **2.17** Verify with `npx tsc -b` & `npm run simulate`.
- [x] **2.18** Git Commit: `refactor(pong): modularize engine and canvas renderer into domain submodules`.

---

## Phase 3: UI & CSS Modularization
- [x] **3.1** Split 449-line `src/pages/pages.css` into `home-page.css`, `game-page.css`, `about-page.css`, and `not-found-page.css`.
- [x] **3.2** Update imports in `home-page.tsx`, `game-page.tsx`, `about-page.tsx`, `not-found-page.tsx` and delete `pages.css`.
- [x] **3.3** Extract `src/site/search/search-results.tsx` from `src/site/search/search-bar.tsx`.
- [x] **3.4** Clean up `src/site/search/search-bar.tsx`.
- [x] **3.5** Fix `src/site/sync-modal.tsx` (remove `#nx-sync-container` coupling and replace `window.location.reload()` with reactive context update).
- [x] **3.6** Clean up `src/site/site-header.tsx` (remove inline style and ID).
- [x] **3.7** Verify with `npx tsc --noEmit`.
- [x] **3.8** Git Commit: `refactor(ui): split page stylesheets and decouple search and modal components`.

---

## Phase 4: Protocol Decoupling, Storage Modularization & Type Safety
- [x] **4.1** Decouple `PongDifficulty` and `player_pong_difficulties` from global `shared/stats-protocol.ts` and `shared/player-record.ts` (make progression generic).
- [x] **4.2** Decouple `PongDifficulty` from `src/games/template/types.ts`.
- [x] **4.3** Modularize `functions/api/stats/d1-store.ts` into `d1-games.ts`, `d1-players.ts`, `d1-sync.ts`, `d1-nonces.ts`, and slim `d1-store.ts`.
- [x] **4.4** Modularize `vite/stats-dev-plugin.ts` by extracting `vite/http-helpers.ts`.
- [x] **4.5** Fix `src/services/stats/local-counters.ts` (remove cross-game candy deduction side effect and raw localStorage loops, use `localStore`).
- [x] **4.6** Fix lazy typing in `src/games/types.ts` (`React.ComponentType<Record<string, never>>`).
- [x] **4.7** Fix lazy typing in `src/services/storage/local-store.ts` (safe validator overloads).
- [x] **4.8** Fix lazy typing in `src/services/stats/stats-api.ts` (`claimSyncCode` return type `Promise<PlayerRecord | null>`).
- [x] **4.9** Fix lazy typing in `functions/api/stats/players.ts` (typed response payload).
- [x] **4.10** Run full validation: `npm run build` (`tsc -b && vite build`) & `npm run simulate`.
- [x] **4.11** Git Commit: `refactor(stats): modularize d1 storage, decouple game progression, and eliminate loose typing`.
- [x] **4.12** Generate walkthrough.
