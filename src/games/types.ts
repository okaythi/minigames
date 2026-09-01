import type React from 'react'


/** Colour keys map onto `accentOf()` in src/theme/palette.ts. */
export type GameAccentName = 'orange' | 'amber' | 'blue' | 'green' | 'red'

export type GameStatus = 'playable' | 'prototype' | 'coming-soon'

export interface GameControlHint {
  /** What the visitor presses, e.g. `Space` or `Click / tap`. */
  readonly input: string
  /** What it does. */
  readonly action: string
}

/** Colour of a legend swatch on the start card. */
export type GameSwatch = 'graphite' | 'orange' | 'amber' | 'green' | 'blue' | 'red'

export interface GameLegendItem {
  readonly swatch: GameSwatch
  readonly text: string
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
  /** Optional aspect ratio override for the game page hero banner (default: '21 / 3.5', tron: '21 / 8'). */
  readonly bannerAspectRatio?: string
  readonly controls: readonly GameControlHint[]
  /** Design notes rendered on the game page. */
  readonly mechanics?: readonly GameMechanic[]
  readonly year: number

  // --- copy for the shared chrome -------------------------------------------
  //
  // The template renders every game identically, so anything a game wants to
  // say has to be a string here. Layout first: the canvas box is reserved from
  // `aspect` before the first frame, so nothing jumps.
  readonly aspect: number
  /** What a point is called, e.g. `Bounces`. Uppercase-ish, it is a label. */
  readonly scoreLabel: string
  /** Optional custom formatter for scores and records (e.g. time mm:ss:ms). */
  readonly formatScore?: (score: number | null) => string
  /** What the bonus pickup is called, e.g. `Candy`. */
  readonly bonusLabel: string
  /** Optional run-duration label; Pong ends on points rather than elapsed time. */
  readonly runDurationLabel?: string
  /** The one-button verb on the primary control, e.g. `Flap`. */
  readonly primaryLabel: string
  /** How the score is earned - one line, shown in the page's Scoring block. */
  readonly scoringNote: string
  /** Start card: headline, then a short body. */
  readonly startLine: string
  readonly intro: string
  /** Paused card body. */
  readonly pauseNote: string
  /** Footnote at the bottom of the readout panel. */
  readonly tip: string
  /** What the colours on the playfield mean. */
  readonly legend: readonly GameLegendItem[]
}

export interface GameModule {
  readonly manifest: GameManifest
  readonly Component: React.LazyExoticComponent<React.ComponentType<Record<string, never>>>
}

export const isPlayable = (manifest: GameManifest): boolean => manifest.status !== 'coming-soon'
