import { layoutFor, applyWorldTransform } from './layout'
import { drawArena } from './draw-arena'
import { drawSpikes } from './draw-spikes'
import { drawPlayer, drawReadyCue } from './draw-player'
import { drawArenaFlash, drawParticles, drawPickups } from './draw-fx'
import type { AvoidSession } from '../engine/session'
import type { GameViewport } from '../../runtime/types'

/**
 * One frame = clear, world transform (including shake), then six layers back to
 * front. Layers never mutate the session: the sim owns state, this owns pixels.
 */

export interface FrameInput {
  readonly context: CanvasRenderingContext2D
  readonly session: AvoidSession
  readonly viewport: GameViewport
  readonly time: number
}

export function drawFrame({ context, session, viewport, time }: FrameInput): void {
  const layout = layoutFor(viewport)

  context.setTransform(1, 0, 0, 1, 0, 0)
  context.clearRect(0, 0, context.canvas.width, context.canvas.height)

  const shake = session.feedback.shake.offset
  applyWorldTransform(context, viewport, layout, shake.x, shake.y)

  context.lineJoin = 'round'
  context.lineCap = 'round'

  drawArena(context, session)
  drawPickups(context, session, time)
  drawSpikes(context, session)
  drawPlayer(context, session)
  drawParticles(context, session)
  drawArenaFlash(context, session)

  if (session.status === 'ready') {
    drawReadyCue(context, session.player, time)
  }

  context.setTransform(1, 0, 0, 1, 0, 0)
}
