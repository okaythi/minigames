import { PALETTE, withAlpha } from '../../../theme/palette'
import { roundRectPath } from '../../../lib/canvas'
import type { CycleState, Direction } from '../engine/types'

const DIRECTION_ANGLES: Readonly<Record<Direction, number>> = {
  up: -Math.PI / 2,
  right: 0,
  down: Math.PI / 2,
  left: Math.PI,
}

export function drawCycles(
  ctx: CanvasRenderingContext2D,
  p1: CycleState,
  ai: CycleState,
  time: number,
): void {
  drawSingleCycle(ctx, p1, PALETTE.blue, PALETTE.blueDeep, '#e4eefb', time)
  drawSingleCycle(ctx, ai, PALETTE.orange, PALETTE.orangeDeep, '#fbad41', time)
}

function drawSingleCycle(
  ctx: CanvasRenderingContext2D,
  cycle: CycleState,
  baseColor: string,
  deepColor: string,
  tintColor: string,
  time: number,
): void {
  if (!cycle.alive) {
    drawCrashedCycleTip(ctx, cycle, tintColor)
    return
  }

  const angle = DIRECTION_ANGLES[cycle.dir]
  ctx.save()
  ctx.translate(cycle.x, cycle.y)
  ctx.rotate(angle)

  // 1. Turbo Thruster Jet (when boosting)
  if (cycle.isTurbo) {
    ctx.save()
    const jetLength = 10 + Math.sin(time * 30) * 3
    const jetGrad = ctx.createLinearGradient(0, 0, -jetLength, 0)
    jetGrad.addColorStop(0, '#fffdf9')
    jetGrad.addColorStop(0.4, tintColor)
    jetGrad.addColorStop(1, withAlpha(baseColor, 0))
    ctx.fillStyle = jetGrad
    ctx.beginPath()
    ctx.moveTo(-6, -2.5)
    ctx.lineTo(-6 - jetLength, 0)
    ctx.lineTo(-6, 2.5)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }

  // 2. Chassis (Clean, sleek, simple geometric light cycle)
  const length = 13
  const width = 6
  ctx.save()
  ctx.shadowColor = withAlpha(baseColor, 0.4)
  ctx.shadowBlur = cycle.isTurbo ? 14 : 6

  // Body capsule
  roundRectPath(ctx, -length + 4, -width / 2, length, width, 2.5)
  ctx.fillStyle = baseColor
  ctx.fill()
  ctx.lineWidth = 1
  ctx.strokeStyle = deepColor
  ctx.stroke()
  ctx.restore()

  // Cockpit canopy / visor
  ctx.fillStyle = '#fffdf9'
  ctx.fillRect(-2, -1.5, 3.5, 3)

  // Headlight beam at tip
  ctx.fillStyle = withAlpha('#fffdf9', 0.9)
  ctx.beginPath()
  ctx.arc(3.5, 0, 1.8, 0, Math.PI * 2)
  ctx.fill()

  ctx.restore()
}

/**
 * Crashed cycle tip: draws cracked little mirror shard fragments
 * with barely perceptible subtle smoke rising from the impact tip.
 */
function drawCrashedCycleTip(
  ctx: CanvasRenderingContext2D,
  cycle: CycleState,
  tintColor: string,
): void {
  const crashPos = cycle.crashedAt ?? { x: cycle.x, y: cycle.y }

  // 1. Shattered Mirror Fragments at the Tip
  ctx.save()
  ctx.translate(crashPos.x, crashPos.y)

  // Shard 1: Center diamond
  ctx.fillStyle = '#fffdf9'
  ctx.strokeStyle = withAlpha(PALETTE.slate, 0.8)
  ctx.lineWidth = 0.8
  ctx.beginPath()
  ctx.moveTo(-2, -3)
  ctx.lineTo(2, -1)
  ctx.lineTo(0, 2)
  ctx.lineTo(-3, 0)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  // Shard 2: Left reflective wing
  ctx.fillStyle = tintColor
  ctx.beginPath()
  ctx.moveTo(-3, -2)
  ctx.lineTo(-5, -5)
  ctx.lineTo(-1, -4)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  // Shard 3: Right mirror spike
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.moveTo(1, -1)
  ctx.lineTo(4, -3)
  ctx.lineTo(3, 2)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  // Shard 4: Bottom chipped glass fragment
  ctx.fillStyle = withAlpha(tintColor, 0.85)
  ctx.beginPath()
  ctx.moveTo(-2, 1)
  ctx.lineTo(1, 4)
  ctx.lineTo(-3, 4)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  ctx.restore()

  // 2. Barely Perceptible Smoke Wisps
  for (const p of cycle.smokeParticles) {
    ctx.save()
    ctx.fillStyle = withAlpha(PALETTE.slate, p.alpha * 0.4)
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}
