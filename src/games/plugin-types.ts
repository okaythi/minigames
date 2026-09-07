import type React from 'react'
import type { GameManifest } from '../../shared/game-manifest'
import type { GameRuntimeFactory } from './template/types'
import type { AchievementDef } from '../../shared/achievements-protocol'
import type { UserPublicProfileResponse, UserGameStat } from '../../shared/auth-protocol'

export type {
  GameManifest,
  GameStatus,
  GameAccentName,
  GameControlHint,
  GameSwatch,
  GameLegendItem,
  GameMechanic,
} from '../../shared/game-manifest'
export { isPlayable } from '../../shared/game-manifest'

export interface ProfileCardProps {
  readonly profile: UserPublicProfileResponse
  readonly stat: UserGameStat | undefined
  readonly isOwner: boolean
  readonly manifest: GameManifest
}

export interface ProfileCardMetric {
  readonly label: string
  readonly value: string
}

export interface GamePluginProfileCard {
  /** Optional custom card renderer to completely replace the showcase card */
  readonly CustomCard?: React.ComponentType<ProfileCardProps> | undefined
  /** Custom visual for the cover slot (e.g. PenguinShowcaseAvatar) */
  readonly renderCover?: ((props: ProfileCardProps) => React.ReactNode) | undefined
  /** Custom metric blocks (overriding Personal Best / World Record) */
  readonly getMetrics?: ((props: ProfileCardProps) => readonly ProfileCardMetric[]) | undefined
  /** Custom run count label (e.g. 'Duels Won') */
  readonly runsLabel?: string | undefined
  /** Custom button label (e.g. { owner: 'Enter Dojo', other: 'Challenge in Dojo' }) */
  readonly actionLabel?: { readonly owner: string; readonly other: string } | undefined
}

export interface GamePluginScoring {
  readonly mode: 'points' | 'time-desc' | 'custom'
  readonly formatScore?: ((score: number | null) => string) | undefined
  /** Determines whether a given highscore integer is considered an established personal best */
  readonly hasValidScore?: ((score: number | null) => boolean) | undefined
}

/**
 * The unified contract for games (both in-repo and from external repositories).
 */
export interface GamePlugin {
  readonly manifest: GameManifest
  /** Factory that builds the runtime engine using standard GameTemplate */
  readonly createRuntime?: GameRuntimeFactory | undefined
  /** Optional custom full-page or stage component (e.g. Card-Jitsu) */
  readonly Component?: React.ComponentType<Record<string, never>> | undefined
  /** Optional custom left sidebar rendering (e.g. Tron Quantum Hologram) */
  readonly renderLeft?: ((snapshot: any) => React.ReactNode) | undefined
  /** Optional game-specific achievement catalogue */
  readonly achievements?: readonly AchievementDef[] | undefined
  readonly profileCard?: GamePluginProfileCard | undefined
  readonly scoring?: GamePluginScoring | undefined
}

export interface GameModule {
  readonly manifest: GameManifest
  readonly Component: React.LazyExoticComponent<React.ComponentType<Record<string, never>>>
  readonly plugin?: GamePlugin | undefined
}
