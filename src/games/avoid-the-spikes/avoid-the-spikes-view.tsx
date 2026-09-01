import { useEffect, useMemo, useRef } from 'react'
import { GameSurface } from '../runtime/game-surface'
import { useGameStats } from '../../services/stats/stats-provider'
import { ARENA } from './engine/config'
import { createAvoidRuntime, type AvoidRuntimeStats } from './runtime'
import { AvoidHud } from './hud/avoid-hud'
import { AvoidOverlay } from './hud/avoid-overlay'
import { AVOID_SLUG, avoidTheSpikesManifest } from './manifest'
import './hud/hud.css'

/**
 * Composition root for the game: the canvas host, the DOM HUD, and the overlay
 * that carries the start / pause / game-over states. No game logic lives here.
 */
export function AvoidTheSpikesView() {
  const stats = useGameStats(AVOID_SLUG)
  // The session is built once, so it reads the *current* stats controller
  // through this ref instead of capturing a stale closure.
  const statsRef = useRef<AvoidRuntimeStats>(stats)
  statsRef.current = stats

  const runtime = useMemo(() => createAvoidRuntime(statsRef), [])
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
          runtime.session.autoPause()
        }
      },
      { threshold: [0, 0.35, 1] },
    )
    observer.observe(node)
    return () => {
      observer.disconnect()
    }
  }, [runtime])

  useEffect(() => () => runtime.dispose(), [runtime])

  return (
    <div className="avoid">
      <div className="avoid-stage" ref={stageRef}>
        <GameSurface
          attach={runtime.attach}
          aspect={ARENA.width / ARENA.height}
          label={`${avoidTheSpikesManifest.title} game area - click or press space to flap`}
        />
        <AvoidOverlay runtime={runtime} />
      </div>
      <AvoidHud runtime={runtime} />
    </div>
  )
}
