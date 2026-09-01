import { withAlpha } from '../../../theme/palette'
import type { Particle } from '../engine/types'

export function drawParticles(ctx: CanvasRenderingContext2D, particles: readonly Particle[]): void {
  for (const p of particles) {
    ctx.save()
    ctx.translate(p.x, p.y)
    if (p.rotation !== undefined) {
      ctx.rotate(p.rotation)
    }

    if (p.shape === 'shard') {
      ctx.fillStyle = withAlpha(p.color, p.alpha)
      ctx.strokeStyle = withAlpha('#ffffff', p.alpha * 0.9)
      ctx.lineWidth = 0.6
      ctx.beginPath()
      ctx.moveTo(-p.size, -p.size * 0.5)
      ctx.lineTo(p.size, -p.size)
      ctx.lineTo(p.size * 0.5, p.size)
      ctx.lineTo(-p.size * 0.5, p.size * 0.5)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    } else if (p.shape === 'spark') {
      ctx.fillStyle = withAlpha(p.color, p.alpha)
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size)
    } else {
      ctx.fillStyle = withAlpha(p.color, p.alpha)
      ctx.beginPath()
      ctx.arc(0, 0, p.size, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.restore()
  }
}
