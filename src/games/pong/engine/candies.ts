import { ARENA } from './config'
import type { PongState } from './types'

export function updateCandy(
  state: PongState,
  dt: number,
  onCandyClaimed: (amount: number, y: number) => void,
): void {
  const s = state
  s.candySpawnTimer -= dt
  if (s.candySpawnTimer <= 0) {
    if (!s.candy.some((candy) => candy.active)) {
      s.candySpawnTimer = 8 + Math.random() * 6
      s.candy.push({
        x: 40 + Math.random() * (ARENA.width - 80),
        y: ARENA.height / 2 - 50 + Math.random() * 100,
        radius: 6,
        active: true,
        claimedBy: null,
      })
    } else {
      s.candySpawnTimer = 3
    }
  }

  for (let i = s.candy.length - 1; i >= 0; i--) {
    const c = s.candy[i]
    if (c && c.active) {
      const dx = s.ball.x - c.x
      const dy = s.ball.y - c.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist <= s.ball.radius + c.radius && s.lastHitBy === 'player') {
        c.active = false
        c.claimedBy = 'player'
        onCandyClaimed(5, c.y)
      }
    }
  }
}
