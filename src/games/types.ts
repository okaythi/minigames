import type { ComponentType } from 'react'

/** Colour keys map onto `accentOf()` in src/theme/palette.ts. */
export type GameAccentName = 'orange' | 'amber' | 'blue' | 'green' | 'red'

export type GameStatus = 'playable' | 'prototype' | 'coming-soon'

export interface GameControlHint {
  /** What the visitor presses, e.g. `Space` or `Click / tap`. */
  readonly input: string
  /** What it does. */
  readonly action: string
}

/** A design note shown on the game page - kept with the game, not the page. */
export interface GameMechanic {
  readonly title: string
  readonly body: string
}

/** Everything the shell knows about a game: no engine internals in here. */
export interface GameManifest {
  readonly slug: string
  readonly title: string
  /** One line for the card. */
  readonly tagline: string
  /** Short paragraph for the game page. */
  readonly description: string
  readonly status: GameStatus
  readonly accent: GameAccentName
  readonly tags: readonly string[]
  /** Imported asset URL (Vite hashes it). */
  readonly cover: string
  /** Optional wide art for the game page hero. */
  readonly banner?: string
  readonly controls: readonly GameControlHint[]
  /** Design notes rendered on the game page. */
  readonly mechanics?: readonly GameMechanic[]
  /** Whether the game submits scores to the global stats record. */
  readonly scores: boolean
  /** Label used for the per-player best, e.g. `bounces`. */
  readonly scoreUnit: string
  readonly year: number
}

/**
 * A game contributes exactly one module that exports this shape. The rest of
 * the site only ever talks to it through the manifest and the React view.
 */
export interface GameModule {
  readonly manifest: GameManifest
  readonly View: ComponentType
}

export const isPlayable = (manifest: GameManifest): boolean => manifest.status !== 'coming-soon'
