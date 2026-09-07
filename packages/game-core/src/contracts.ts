import type React from 'react'
import type { Disposable } from './disposable'
import type { Store } from './observable-store'

// 1. Viewport & Canvas Host
export interface GameViewport {
  readonly width: number
  readonly height: number
  readonly dpr: number
}

export type FrameListener = (deltaSeconds: number, elapsedSeconds: number) => void
export type ResizeListener = (viewport: GameViewport) => void
export type VisibilityListener = (visible: boolean) => void

export interface GameHost {
  readonly canvas: HTMLCanvasElement
  readonly context: CanvasRenderingContext2D
  viewport(): GameViewport
  readonly onFrame: (listener: FrameListener) => Disposable
  readonly onResize: (listener: ResizeListener) => Disposable
  readonly onVisibility: (listener: VisibilityListener) => Disposable
}

export type GameViewFactory = (host: GameHost) => Disposable

// 2. Snapshot & State
export type GameRunStatus = 'ready' | 'running' | 'paused' | 'over'

export interface GameStatTile {
  readonly label: string
  readonly value: string
  readonly note: string
}

export interface GameRunSummary {
  readonly score: number
  readonly bonus: number
  readonly seconds: number
  readonly note: string
  readonly isRecord: boolean
  readonly beatBestBy: number | null
}

export interface GameSnapshot {
  readonly status: GameRunStatus
  readonly score: number
  readonly best: number | null
  readonly bonus: number
  readonly tiles: readonly GameStatTile[]
  readonly badges: readonly string[]
  readonly run: GameRunSummary | null
  readonly muted: boolean
  readonly customState?: {
    readonly level?: number
    readonly phase?: string
    readonly [key: string]: unknown
  }
}

export const emptyGameSnapshot = (muted = false): GameSnapshot => ({
  status: 'ready',
  score: 0,
  best: null,
  bonus: 0,
  tiles: [],
  badges: [],
  run: null,
  muted,
})

// 3. Runtime Contract
export interface GameActions {
  readonly primary: () => void
  readonly pause: () => void
  readonly resume: () => void
  readonly restart: () => void
  readonly toggleMute: () => void
}

export interface GameFinishDetails {
  readonly difficulty?: string
  readonly won?: boolean
}

export interface GameRuntimeDeps {
  readonly best: number | null
  readonly bonus: number
  readonly completedDifficulties: readonly string[]
  readonly beginRun: () => void
  readonly finishRun: (score: number, details?: GameFinishDetails) => void
  readonly bankBonus: (amount: number) => void
  readonly developer: boolean
}

export interface GameRuntime {
  readonly store: Store<GameSnapshot>
  readonly actions: GameActions
  readonly attach: GameViewFactory
  readonly dispose: () => void
}

export type GameRuntimeFactory = (deps: { readonly current: GameRuntimeDeps }) => GameRuntime

// 4. Manifest
export type GameAccentName = 'orange' | 'amber' | 'blue' | 'green' | 'red'
export type GameStatus = 'playable' | 'prototype' | 'coming-soon' | 'new'

export interface GameControlHint {
  readonly input: string
  readonly action: string
}

export type GameSwatch = 'graphite' | 'orange' | 'amber' | 'green' | 'blue' | 'red'

export interface GameLegendItem {
  readonly swatch: GameSwatch
  readonly text: string
}

export interface GameMechanic {
  readonly title: string
  readonly body: string
}

export interface GameManifest {
  readonly slug: string
  readonly title: string
  readonly flag?: string | undefined
  readonly gameFlag?: string | undefined
  readonly tagline: string
  readonly description: string
  readonly status: GameStatus
  readonly accent: GameAccentName
  readonly tags: readonly string[]
  readonly cover: string
  readonly banner?: string | undefined
  readonly bannerAspectRatio?: string | undefined
  readonly layout?: 'standard' | 'horizontal' | undefined
  readonly controls: readonly GameControlHint[]
  readonly mechanics?: readonly GameMechanic[] | undefined
  readonly year: number
  readonly aspect: number
  readonly scoreLabel: string
  readonly formatScore?: ((score: number | null) => string) | undefined
  readonly bonusLabel: string
  readonly runDurationLabel?: string | undefined
  readonly primaryLabel: string
  readonly scoringNote: string
  readonly startLine: string
  readonly intro: string
  readonly pauseNote: string
  readonly tip: string
  readonly legend: readonly GameLegendItem[]
}

export const isPlayable = (manifest: GameManifest): boolean => manifest.status !== 'coming-soon'

// 5. Pluggable Mechanics
export interface ProfileCardProps {
  readonly profile: any
  readonly stat: any
  readonly isOwner: boolean
  readonly manifest: GameManifest
}

export interface ProfileCardMetric {
  readonly label: string
  readonly value: string
}

export interface GamePluginProfileCard {
  readonly CustomCard?: React.ComponentType<ProfileCardProps> | undefined
  readonly renderCover?: ((props: ProfileCardProps) => React.ReactNode) | undefined
  readonly getMetrics?: ((props: ProfileCardProps) => readonly ProfileCardMetric[]) | undefined
  readonly runsLabel?: string | undefined
  readonly actionLabel?: { readonly owner: string; readonly other: string } | undefined
}

export interface GamePluginScoring {
  readonly mode: 'points' | 'time-desc' | 'custom'
  readonly formatScore?: ((score: number | null) => string) | undefined
  readonly hasValidScore?: ((score: number | null) => boolean) | undefined
}

export interface GamePlugin {
  readonly manifest: GameManifest
  readonly createRuntime?: GameRuntimeFactory | undefined
  readonly Component?: React.ComponentType<Record<string, never>> | undefined
  readonly renderLeft?: ((snapshot: GameSnapshot) => React.ReactNode) | undefined
  readonly achievements?: readonly any[] | undefined
  readonly profileCard?: GamePluginProfileCard | undefined
  readonly scoring?: GamePluginScoring | undefined
}
