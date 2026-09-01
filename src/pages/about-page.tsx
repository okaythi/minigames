import type { CSSProperties } from 'react'
import { Link } from '../app/link'
import { ROUTES } from '../app/parse-route'
import { Tag } from '../components/ui/tag'
import { GameGrid } from '../games/game-grid'
import { MANIFESTS } from '../games/registry'
import './pages.css'

export function AboutPage() {
  return (
    <div className="nx-doc">
      <p className="nx-eyebrow">About the lab</p>
      <h1>Nixlabs Games</h1>
      <p className="nx-lede">
        A personal collection of browser minigames. One repository, one build, one
        folder per game - no engine, no framework in the game loop, no build step
        between an idea and something you can play.
      </p>

      <hr className="nx-hairline" />

      <section>
        <h2>The stack, and why</h2>
        <p>
          <strong>TypeScript for everything, HTML5 Canvas for the playfield.</strong>{' '}
          Canvas 2D is the right tool for arcade-scale games: a single immediate-mode
          surface, no DOM churn, and no runtime heavier than the ~30 KB of game code a
          title needs. WebGL would buy nothing at 360×480 logical pixels, and a DOM
          renderer would fight the 120 Hz fixed-step simulation.
        </p>
        <p>
          React sits <em>outside</em> the loop. It draws the menu, the cards, the HUD and
          the overlays, and it only re-renders when a value a human can read actually
          changes. The simulation never imports React, and React never touches the
          simulation's internals - they meet at one typed contract in{' '}
          <code>src/games/runtime</code>.
        </p>
        <ul className="nx-doc-list">
          <li>Vite for dev and build; <code>tsc -b</code> runs first, so a broken type never ships.</li>
          <li>Strictest reasonable <code>tsconfig</code>: <code>noUncheckedIndexedAccess</code>, <code>exactOptionalPropertyTypes</code>, <code>noImplicitOverride</code>, and no <code>any</code> anywhere in <code>src</code>.</li>
          <li>No game framework, no physics library, no audio files - all sound is synthesised with Web Audio.</li>
        </ul>
      </section>

      <section>
        <h2>How the repo is organised</h2>
        <pre className="nx-code" aria-label="Repository layout">
{`src/
  games/
    registry.ts           one line per game
    types.ts              GameManifest + GameModule
    runtime/              canvas host, rAF loop, DPR, resize
    template/             the one game page: stage, readout, overlay
    avoid-the-spikes/
      manifest.ts         what the site shows, in words
      runtime.ts          the engine behind the template's contract
      engine/             the simulation: physics, spikes, movers,
                          pickups, particles, audio, session
      render/             canvas layers, world transform
      state.ts            the engine's own snapshot
shared/
  stats-protocol.ts       wire format for the counters
functions/
  api/stats/index.ts      Cloudflare Pages Function (D1)
vite/
  stats-dev-plugin.ts     the same endpoint during \`vite dev\``}
        </pre>
        <p>
          A game owns its directory end to end. Nothing in <code>src/games</code> knows
          about another game, and adding one is: create the folder, export a{' '}
          <code>GameModule</code>, add it to the registry.
        </p>
      </section>

      <section>
        <h2>Colours</h2>
        <p>
          Cloudflare's orange, unmodified, on an off-white paper - never pure{' '}
          <code>#fff</code> - with grey hairlines as the only structural ornament.
        </p>
        <ul className="nx-swatches">
          {[
            { name: 'Cloudflare orange', hex: '#f6821f' },
            { name: 'Amber', hex: '#fbad41' },
            { name: 'Off-white', hex: '#faf7f2' },
            { name: 'Graphite', hex: '#404041' },
            { name: 'Hairline grey', hex: '#e6e0d6' },
            { name: 'Green', hex: '#1f9d5b' },
            { name: 'Blue', hex: '#1f6fd1' },
            { name: 'Red', hex: '#d8433d' },
          ].map((swatch) => (
            <li key={swatch.hex}>
              <span style={{ '--nx-chip': swatch.hex } as CSSProperties} aria-hidden="true" />
              <strong>{swatch.name}</strong>
              <code>{swatch.hex}</code>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Counters</h2>
        <p>
          "Times played" is a real global counter when the deployment has a D1 database
          bound (<code>NIXLABS_DB</code>): a Pages Function increments it on every run and
          on every submitted score. Without the binding - a fork, a preview, an offline
          <code>vite build</code> - the same UI falls back to <code>localStorage</code> and
          labels the number "this device" instead of pretending.
        </p>
        <p>
          Your personal best, your banked candy and your mute preference always live in{' '}
          <code>localStorage</code> under the <code>nixlabs.</code> prefix, so a run is
          never lost to a closed tab, and the site works with the network unplugged once
          the shell is cached.
        </p>
      </section>

      <section>
        <h2>Deploying to Cloudflare Pages</h2>
        <ol className="nx-doc-steps">
          <li>Build command <code>npm run build</code>, output directory <code>dist</code>.</li>
          <li>
            Create a D1 database and bind it to the Pages project as{' '}
            <code>NIXLABS_DB</code> (optional, but it turns the counters global).
          </li>
          <li>
            <code>public/_redirects</code> sends unknown paths to <code>index.html</code>, so
            <code>/games/avoid-the-spikes</code> is a real URL.
          </li>
          <li>Or locally: <code>npm run deploy</code> (<code>wrangler pages deploy</code>).</li>
        </ol>
      </section>

      <hr className="nx-hairline" />

      <section>
        <h2>Everything in the catalogue</h2>
        <GameGrid games={MANIFESTS} label="All games" />
        <p className="nx-doc-back">
          <Link to={ROUTES.home}>
            <Tag>Back to games</Tag>
          </Link>
        </p>
      </section>
    </div>
  )
}
