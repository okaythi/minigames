import { PALETTE, withAlpha } from '../../../theme/palette'
import { roundRectPath } from '../../avoid-the-spikes/render/draw-utils'

export function drawPongCandy(context: CanvasRenderingContext2D, x: number, y: number, time: number): void {
  context.save()
  context.translate(x, y)
  const spin = Math.sin(time * 2.1) * 0.35
  context.rotate(spin)

  // Glow ring
  context.beginPath()
  context.arc(0, 0, 14, 0, Math.PI * 2)
  context.fillStyle = withAlpha(PALETTE.orangeBright, 0.16)
  context.fill()

  roundRectPath(context, -7, -5.4, 14, 10.8, 4)
  context.fillStyle = PALETTE.orangeBright
  context.fill()
  context.lineWidth = 1.5
  context.strokeStyle = PALETTE.orangeDeep
  context.stroke()

  // Wrapper twists
  context.beginPath()
  context.moveTo(-7, -4)
  context.lineTo(-12, -7)
  context.lineTo(-11, 0)
  context.lineTo(-12, 7)
  context.lineTo(-7, 4)
  context.moveTo(7, -4)
  context.lineTo(12, -7)
  context.lineTo(11, 0)
  context.lineTo(12, 7)
  context.lineTo(7, 4)
  context.closePath()
  context.fillStyle = PALETTE.orange
  context.fill()
  context.stroke()

  context.restore()
}
