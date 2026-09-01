import { ARENA } from '../engine/config'
import type { GameViewport } from '../../runtime/types'

/**
 * The simulation always runs in a fixed 360x480 world; this is the only place
 * that maps world units to device pixels.
 */

export const PADDING = 12

export interface ArenaLayout {
  readonly scale: number
  readonly offsetX: number
  readonly offsetY: number
  readonly width: number
  readonly height: number
}

export function layoutFor(viewport: GameViewport): ArenaLayout {
  const available = Math.max(1, Math.min(viewport.width - PADDING * 2, viewport.height - PADDING * 2))
  const scale = Math.min(available / ARENA.width, available / ARENA.height)
  const width = ARENA.width * scale
  const height = ARENA.height * scale
  return {
    scale,
    offsetX: (viewport.width - width) / 2,
    offsetY: (viewport.height - height) / 2,
    width,
    height,
  }
}

/** Applies dpr + arena transform so layer code can draw in world units. */
export function applyWorldTransform(
  context: CanvasRenderingContext2D,
  viewport: GameViewport,
  layout: ArenaLayout,
  shakeX: number,
  shakeY: number,
): void {
  context.setTransform(viewport.dpr, 0, 0, viewport.dpr, 0, 0)
  context.translate(layout.offsetX + shakeX * layout.scale, layout.offsetY + shakeY * layout.scale)
  context.scale(layout.scale, layout.scale)
}
