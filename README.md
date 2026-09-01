# Nixlabs Games

A small collection of browser minigames. One repository, one build, one folder per game -
hosted as a static site on Cloudflare Pages.

**Live surface:** a header menu with a search box that finds titles, a three-column grid of
game cards, and the games themselves.

---

## The stack, and the language choice

**TypeScript for everything, HTML5 Canvas 2D for the playfield.** That is the recommendation
this repo is built on, and it is deliberate:

- Canvas 2D is the right tool at arcade scale. One immediate-mode surface, no DOM churn, no
  runtime heavier than the game's own few dozen kilobytes. WebGL buys nothing at 360×480
  logical pixels; a DOM renderer fights a 120 Hz fixed-step simulation.
- TypeScript's strict mode is what keeps a game codebase from rotting: `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `noImplicitOverride`, `verbatimModuleSyntax`, and no `any`
  anywhere in `src/`. The build runs `tsc -b` **before** Vite, so a broken type never ships.
- React is only the shell. It renders the menu, cards, HUD and overlays. It never enters the
  game loop, and the game loop never imports React - they meet at one typed contract in
  `src/games/runtime`.
- No game engine, no physics library, no audio files. All sound in
  [Avoid the Spikes!](src/games/avoid-the-spikes/engine/audio) is synthesised with Web Audio.

## Scripts

| Command                     | What it does                                                  |
| --------------------------- | ------------------------------------------------------------- |
| `npm run dev`               | Vite dev server, including the local stats endpoint.          |
| `npm run build`             | `tsc -b` (project references, strict) then the production bundle. |
| `npm run preview`           | Serves `dist/` locally.                                       |
| `npm run typecheck`         | Type-checks `src` + `shared`, `vite.config.ts` + `vite`, `functions`. |
| `npm run simulate`          | Headless engine invariants for the games (no browser, no canvas). |
| `npm run deploy`            | Build, then `wrangler pages deploy dist`.                     |
| `npm run preview:functions` | `wrangler pages dev dist --d1 NIXLABS_DB=…` — the built site with a real (local) D1. |
| `npm run db:create`         | `wrangler d1 create nixlabs-games`; prints the `database_id` for `wrangler.jsonc`. |
| `npm run db:init`           | Applies `migrations/` to the local D1 sandbox.                |
| `npm run db:migrate`        | Applies `migrations/` to the online D1 database.              |

## Repository layout

```
src/
  app/                  router (70 lines, no dependency), document title, routes
  styles/               tokens.css (palette, type, radii) + base.css (reset)
  theme/palette.ts      the same hexes for canvas, which cannot read CSS variables
  lib/                  math, easing, seeded random, disposable, store, format
  services/
    storage/            namespaced localStorage wrapper that never throws
    stats/              unique players + global counters: edge (D1), local fallback
    .../player-identity.ts  anonymous uuid, one per browser
  site/                 header, footer, brand, search (fuzzy matcher + combobox)
  components/ui/        button, tag, empty state
  pages/                home, game, about, not found
  games/
    types.ts            GameManifest + GameModule - the only public surface of a game
    registry.ts         one line per game
    game-card.tsx       image, title, description, times played, highscore
    game-grid.tsx       three columns
    runtime/            canvas host: DPR backing store, resize, rAF, visibility
    avoid-the-spikes/
      manifest.ts       what the site shows
      state.ts          the snapshot the HUD may read
      engine/           config, player, speed-curve, spike-factory, wall-spike-field,
                        movers, pickups, particles, screen-shake, collision (SAT),
                        geometry, session, audio/
      render/           layout + five draw layers + composer
      hud/              DOM readout and overlay cards
      cover.jpg banner.jpg
shared/
  stats-protocol.ts     wire format, shared by client and Pages Function
functions/
  api/stats/index.ts    Cloudflare Pages Function: HTTP layer
  api/stats/store.ts    D1 + in-memory stores behind one interface
migrations/
  0001_init.sql         D1 schema: game_stats, players, seen_nonces
vite/
  stats-dev-plugin.ts   the same endpoint during `vite dev`, backed by a JSON file
scripts/
  simulate-avoid.ts     headless engine invariants
public/
  nixlabs-mark.svg      the logo (also the favicon source)
  favicon.svg           rounded-tile version of the mark
  apple-touch-icon.png  generated from the same drawing
  _redirects _headers robots.txt site.webmanifest
docs/
  adding-a-game.md      the recipe
```

## Rules of the house

- **No monoliths.** Nothing but the page shells gets near 300 lines, and there is no
  "Game.ts" that owns physics, input, rendering and UI. Every tunable number is in one
  config file, collision is its own file, and each render layer draws exactly one thing.
- **Strict typing, no `any`.** Untrusted JSON is narrowed through validators in
  `shared/stats-protocol.ts`; games read typed values or nothing at all.
- **A game owns its folder.** Nothing in `src/games` knows about another game. The site only
  ever touches a game through its `GameManifest` and its React `View`.
- **State lives in one place.** The engine mutates its own state and publishes an immutable
  snapshot to a tiny store; React subscribes with `useSyncExternalStore`. No per-frame renders.

## Colours

Cloudflare's orange, unmodified, on an off-white paper (never pure `#fff`), with grey hairlines
as the only structural ornament.

| Token                  | Hex       | Used for                                  |
| ---------------------- | --------- | ----------------------------------------- |
| `--nx-orange`          | `#f6821f` | brand, primary actions, wall teeth        |
| `--nx-orange-bright`   | `#fbad41` | amber secondary, candy                    |
| `--nx-paper`           | `#faf7f2` | page background                           |
| `--nx-card`            | `#fffdf9` | surfaces                                  |
| `--nx-ink` / graphite  | `#232324` / `#404041` | text, outlines, permanent hazards |
| `--nx-line`            | `#e6e0d6` | hairlines                                 |
| `--nx-green`           | `#1f9d5b` | gems, personal-best state                 |
| `--nx-blue`            | `#1f6fd1` | informational accents                     |
| `--nx-red`             | `#d8433d` | floating spikes, destructive state        |

Full list in [`src/styles/tokens.css`](src/styles/tokens.css); the canvas mirror is
[`src/theme/palette.ts`](src/theme/palette.ts).

## Counters: global plays, personal bests

Two tables, one row each per game and per visitor (`migrations/0001_init.sql`):
`game_stats` holds plays and the best score ever submitted, `players` holds one row per
anonymous visitor — a uuid minted in `src/services/stats/player-identity.ts`, sent with every
event, which is what the hero's "Unique players" counts. A visit is announced once per page
load, so a player is counted even if they never press play. Every event carries a nonce, so a
retry cannot double-count.

| Data                  | Source                                          |
| --------------------- | ----------------------------------------------- |
| times played          | D1 when bound, otherwise this browser           |
| unique players        | D1 only                                         |
| highscore (yours)     | `localStorage`                                  |
| global record         | D1                                              |
| banked candy, mute    | `localStorage`                                  |

No binding, no network, private mode, offline build: the same UI renders, labels the number
"this device", and nothing breaks — `store.ts` swaps `d1Store` for `memoryStore` and reports
`distributed: false`. During `vite dev`, `vite/stats-dev-plugin.ts` serves the identical
endpoint from `.nixlabs/stats.json`, so the client never has two code paths.

## Deploying to Cloudflare Pages

1. Connect the repository; build command `npm run build`, output directory `dist`.
2. (Optional, but this is what makes the counters global) create the database, paste its id
   into `wrangler.jsonc`, then push the schema:

   ```sh
   npm run db:create     # -> database_id for wrangler.jsonc (replaces the placeholder)
   npm run db:migrate    # applies migrations/0001_init.sql online
   ```

3. `public/_redirects` rewrites unknown paths to `index.html`, so `/games/avoid-the-spikes`
   is a real, shareable URL. `public/_headers` caches `/assets/*` immutably.
4. Or from a terminal: `npm run deploy`.

## Games

| Title                                     | Status  | What it is                                                        |
| ----------------------------------------- | ------- | ----------------------------------------------------------------- |
| [Avoid the Spikes!](src/games/avoid-the-spikes) | shipped | Fall, flap, bounce off a wall for +1; every bounce arms the next wall with teeth. |

Design, physics and the tuning rationale for that game live in its own folder -
start with [`engine/config.ts`](src/games/avoid-the-spikes/engine/config.ts), where every number
has a comment explaining why it is that value.
