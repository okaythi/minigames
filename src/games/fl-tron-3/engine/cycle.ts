import { RULES } from './config'
import { OCCUPANCY, OccupancyGrid } from './grid'
import type { CycleId, CycleState, Direction, Particle, Point, SmokeParticle } from './types'

export const OPPOSITE_DIRECTIONS: Readonly<Record<Direction, Direction>> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
}

export const DIRECTION_VECTORS: Readonly<Record<Direction, Point>> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

export function createCycle(id: CycleId, col: number, row: number, dir: Direction, maxTurbos = 3): CycleState {
  const worldPos = OccupancyGrid.gridToWorld(col, row)
  return {
    id,
    x: worldPos.x,
    y: worldPos.y,
    col,
    row,
    dir,
    targetDir: dir,
    inputBuffer: [],
    alive: true,
    crashedAt: null,
    crashTime: null,
    smokeParticles: [],
    turbosLeft: maxTurbos,
    isTurbo: false,
    turboTimer: 0,
    turboCooldown: 0,
    turboFlickerTimer: 0,
    trail: [
      {
        isTurbo: false,
        points: [worldPos, { ...worldPos }],
      },
    ],
  }
}

export function queueDirection(
  cycle: CycleState,
  newDir: Direction,
  now: number = performance.now() / 1000,
): void {
  if (!cycle.alive) return

  // Filter out any expired inputs (TTL 1.2s)
  const activeBuffer = cycle.inputBuffer.filter((entry) => entry.expiresAt > now)

  // Compare against the projected final direction in the buffer, or current cycle.dir if buffer is empty
  const lastItem = activeBuffer[activeBuffer.length - 1]
  const currentRefDir = lastItem ? lastItem.dir : cycle.dir

  if (newDir === currentRefDir || newDir === OPPOSITE_DIRECTIONS[currentRefDir]) {
    cycle.inputBuffer = activeBuffer
    return
  }

  if (activeBuffer.length < 6) {
    cycle.inputBuffer = [
      ...activeBuffer,
      {
        dir: newDir,
        expiresAt: now + 1.2,
      },
    ]
  } else {
    cycle.inputBuffer = activeBuffer
  }
}

export function triggerCycleTurbo(cycle: CycleState, isInfinite = false): boolean {
  if (!cycle.alive || cycle.isTurbo || cycle.turboCooldown > 0) {
    return false
  }
  if (!isInfinite && cycle.turbosLeft <= 0) {
    return false
  }

  cycle.isTurbo = true
  cycle.turboTimer = RULES.turboDurationSeconds
  cycle.turboCooldown = RULES.turboCooldownSeconds + RULES.turboDurationSeconds
  cycle.turboFlickerTimer = 0.35

  if (!isInfinite) {
    cycle.turbosLeft = Math.max(0, cycle.turbosLeft - 1)
  }

  // Finalize previous segment tip and start a new turbo segment at current position
  const currentPos: Point = { x: cycle.x, y: cycle.y }
  const currentSeg = cycle.trail[cycle.trail.length - 1]
  if (currentSeg && currentSeg.points.length > 0) {
    currentSeg.points[currentSeg.points.length - 1] = { ...currentPos }
  }
  cycle.trail.push({
    isTurbo: true,
    points: [{ ...currentPos }, { ...currentPos }],
  })

  return true
}

export function updateCycleTimers(cycle: CycleState, dt: number): void {
  if (cycle.turboTimer > 0) {
    cycle.turboTimer -= dt
    if (cycle.turboTimer <= 0) {
      cycle.isTurbo = false
      cycle.turboTimer = 0

      // Finalize turbo segment tip and start a new normal segment at current position
      const currentPos: Point = { x: cycle.x, y: cycle.y }
      const currentSeg = cycle.trail[cycle.trail.length - 1]
      if (currentSeg && currentSeg.points.length > 0) {
        currentSeg.points[currentSeg.points.length - 1] = { ...currentPos }
      }
      cycle.trail.push({
        isTurbo: false,
        points: [{ ...currentPos }, { ...currentPos }],
      })
    }
  }

  if (cycle.turboCooldown > 0) {
    cycle.turboCooldown = Math.max(0, cycle.turboCooldown - dt)
  }

  if (cycle.turboFlickerTimer > 0) {
    cycle.turboFlickerTimer = Math.max(0, cycle.turboFlickerTimer - dt)
  }

  // Update smoke particles if crashed
  if (!cycle.alive && cycle.crashedAt !== null) {
    const updatedSmoke: SmokeParticle[] = []
    for (const p of cycle.smokeParticles) {
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vy -= 4 * dt // gentle upward rise
      p.life += dt
      p.alpha = Math.max(0, 0.28 * (1 - p.life / p.maxLife))
      p.size += 3.5 * dt
      if (p.life < p.maxLife) {
        updatedSmoke.push(p)
      }
    }

    // Spawn tiny, barely perceptible subtle wisp of smoke periodically
    if (Math.random() < 0.18 && updatedSmoke.length < 6) {
      updatedSmoke.push({
        x: cycle.crashedAt.x + (Math.random() * 4 - 2),
        y: cycle.crashedAt.y + (Math.random() * 4 - 2),
        vx: (Math.random() - 0.5) * 6,
        vy: -12 - Math.random() * 8,
        alpha: 0.25,
        size: 1.8,
        life: 0,
        maxLife: 1.4 + Math.random() * 0.8,
      })
    }
    cycle.smokeParticles = updatedSmoke
  }
}

export function triggerCycleCrash(cycle: CycleState, grid: OccupancyGrid): Particle[] {
  if (!cycle.alive) return []
  cycle.alive = false
  const crashPos: Point = { x: cycle.x, y: cycle.y }
  cycle.crashedAt = crashPos
  cycle.crashTime = performance.now()
  cycle.isTurbo = false

  const currentSeg = cycle.trail[cycle.trail.length - 1]
  if (currentSeg && currentSeg.points.length > 0) {
    currentSeg.points[currentSeg.points.length - 1] = { ...crashPos }
  }

  // Produce mirror shards and subtle spark explosion
  const shards: Particle[] = []
  const shardCount = 14
  for (let i = 0; i < shardCount; i += 1) {
    const angle = Math.random() * Math.PI * 2
    const speed = 25 + Math.random() * 85
    shards.push({
      x: crashPos.x,
      y: crashPos.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color: cycle.id === 'p1' ? '#e4eefb' : '#fdeadd',
      alpha: 0.95,
      size: 2 + Math.random() * 3,
      life: 0,
      maxLife: 0.6 + Math.random() * 0.4,
      shape: 'shard',
      rotation: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 12,
    })
  }

  // Register final trail tip
  grid.set(cycle.col, cycle.row, cycle.id === 'p1' ? OCCUPANCY.p1Trail : OCCUPANCY.aiTrail)
  return shards
}
