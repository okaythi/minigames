import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { GameSurface } from '../runtime/game-surface'
import type { GameRuntime } from './types'
import type { GameManifest } from '../types'

interface GameStageProps {
  readonly runtime: GameRuntime
  readonly manifest: GameManifest
  /** Stacked on top of the canvas: the overlay cards. */
  readonly children: ReactNode
}

/**
 * The playfield: a canvas the game owns, plus whatever the chrome stacks on it.
 *
 * Scrolling the stage most than two-thirds off screen pauses the run, because a
 * game that keeps simulating behind the footer is a game that cheated you out of
 * a score.
 */
export function GameStage({ runtime, manifest, children }: GameStageProps) {
  const stageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const node = stageRef.current
    if (node === null) {
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry !== undefined && entry.intersectionRatio < 0.35) {
          runtime.actions.pause()
        }
      },
      { threshold: [0, 0.35, 1] },
    )
    observer.observe(node)
    return () => {
      observer.disconnect()
    }
  }, [runtime])

  return (
    <div className="nx-play-stage" ref={stageRef}>
      <GameSurface
        attach={runtime.attach}
        aspect={manifest.aspect}
        label={`${manifest.title} game area`}
      />
      {children}
    </div>
  )
}
