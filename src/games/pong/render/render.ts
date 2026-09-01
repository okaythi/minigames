import type { GameHost, GameViewport } from '../../runtime/types'
import type { PongEngine, PowerupType } from '../engine/engine'
import { ARENA, COSTS, POWERUP_DURATIONS, extensionScale } from '../engine/config'
import { drawPongCandy } from './candy'
import { PALETTE, withAlpha } from '../../../theme/palette'
import { roundRectPath } from '../../avoid-the-spikes/render/draw-utils'

interface PongFonts {
  readonly sans: string
  readonly mono: string
}

interface TrailDot {
  readonly x: number
  readonly y: number
  life: number
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  life: number
  readonly maxLife: number
  readonly color: string
}

interface PulseRing {
  readonly x: number
  readonly y: number
  readonly color: string
  life: number
  readonly maxLife: number
  readonly maxRadius: number
}

interface PongFx {
  readonly trail: TrailDot[]
  readonly particles: Particle[]
  readonly rings: PulseRing[]
  previousBall: { x: number; y: number } | null
  lastPlayerHits: number
  lastPlayerScore: number
  lastAiScore: number
}

const SHOP_ITEMS: readonly { type: PowerupType; name: string }[] = [
  { type: 'speed', name: 'Speed Boost' },
  { type: 'extension', name: 'Paddle Extension' },
  { type: 'magnet', name: 'Magnet' },
  { type: 'glass-wall', name: 'Glass Wall' },
]

const FALLBACK_SANS = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
const FALLBACK_MONO = "ui-monospace, 'SF Mono', Menlo, Consolas, monospace"

export function attachPongRender(engine: PongEngine, host: GameHost) {
  const { canvas, context, onFrame } = host
  const fonts = fontsFor(canvas)
  const fx = createFx()

  let lastTime = performance.now()

  const tick = () => {
    const now = performance.now()
    const dt = Math.min((now - lastTime) / 1000, 0.1)
    lastTime = now

    engine.update(dt)
    captureFx(engine, fx)
    advanceFx(fx, dt)
    draw(context, engine, now / 1000, host.viewport(), fonts, fx)
  }

  const frameSub = onFrame(tick)

  const pointerPosition = (e: MouseEvent | TouchEvent) => {
    const rect = canvas.getBoundingClientRect()
    const touches = 'touches' in e ? e.touches : null
    const clientX = touches ? touches[0]?.clientX ?? 0 : (e as MouseEvent).clientX
    const clientY = touches ? touches[0]?.clientY ?? 0 : (e as MouseEvent).clientY
    return {
      x: (clientX - rect.left) / rect.width * ARENA.width,
      y: (clientY - rect.top) / rect.height * ARENA.height,
    }
  }

  const onPointerDown = (e: MouseEvent | TouchEvent) => {
    engine.pointerDown = true
    const point = pointerPosition(e)
    engine.pointerX = point.x

    if (e.cancelable && e.type === 'touchstart') e.preventDefault()

    if (engine.state.phase === 'playing' && engine.state.ball.stuckToPlayer) {
      engine.releaseMagnetBall()
      return
    }

    if (engine.state.phase === 'config') {
      if (point.y >= 100 && point.y <= 140) {
        if (point.x >= 40 && point.x <= 120) engine.state.mode = 11
        else if (point.x >= 140 && point.x <= 220) engine.state.mode = 21
        else if (point.x >= 240 && point.x <= 320) engine.state.mode = 30
      }

      if (point.y >= 200 && point.y <= 240) {
        if (point.x >= 40 && point.x <= 100) engine.state.difficulty = 'easy'
        else if (point.x >= 120 && point.x <= 200) engine.state.difficulty = 'normal'
        else if (point.x >= 220 && point.x <= 280) engine.state.difficulty = 'hard'
      }
      if (point.y >= 250 && point.y <= 290) {
        if (point.x >= 40 && point.x <= 180 && engine.isVeryHardUnlocked()) {
          engine.state.difficulty = 'very-hard'
        }
      }

      if (
        point.x >= ARENA.width / 2 - 50 &&
        point.x <= ARENA.width / 2 + 50 &&
        point.y >= ARENA.height - 80 &&
        point.y <= ARENA.height - 40
      ) {
        engine.confirmConfig()
      }
      return
    }

    if (engine.state.phase === 'loadout') {
      if (
        point.x >= ARENA.width / 2 - 50 &&
        point.x <= ARENA.width / 2 + 50 &&
        point.y >= ARENA.height - 80 &&
        point.y <= ARENA.height - 40
      ) {
        engine.startMatch()
        return
      }

      for (const item of SHOP_ITEMS) {
        const itemY = itemYFor(item.type)
        if (point.x >= 40 && point.x <= ARENA.width - 40 && point.y >= itemY && point.y <= itemY + 40) {
          const emptyIdx = engine.state.slots.indexOf(null)
          if (emptyIdx !== -1 && engine.deps.current.bonus >= COSTS[item.type]) {
            engine.deps.current.bankBonus(-COSTS[item.type])
            engine.state.slots[emptyIdx] = item.type
          }
        }
      }
    }
  }

  const onPointerMove = (e: MouseEvent | TouchEvent) => {
    if (engine.pointerDown || engine.state.phase === 'playing') {
      engine.pointerX = pointerPosition(e).x
      if (e.cancelable && e.type === 'touchmove') e.preventDefault()
    }
  }

  const onPointerUp = () => {
    engine.pointerDown = false
  }

  const onKeyDown = (e: KeyboardEvent) => {
    engine.handleInput(e.key, true)
  }

  canvas.addEventListener('mousedown', onPointerDown)
  canvas.addEventListener('touchstart', onPointerDown, { passive: false })
  window.addEventListener('mousemove', onPointerMove)
  window.addEventListener('touchmove', onPointerMove, { passive: false })
  window.addEventListener('mouseup', onPointerUp)
  window.addEventListener('touchend', onPointerUp)
  window.addEventListener('keydown', onKeyDown)

  return {
    dispose: () => {
      frameSub.dispose()
      canvas.removeEventListener('mousedown', onPointerDown)
      canvas.removeEventListener('touchstart', onPointerDown)
      window.removeEventListener('mousemove', onPointerMove)
      window.removeEventListener('touchmove', onPointerMove)
      window.removeEventListener('mouseup', onPointerUp)
      window.removeEventListener('touchend', onPointerUp)
      window.removeEventListener('keydown', onKeyDown)
    },
  }
}

function fontsFor(canvas: HTMLCanvasElement): PongFonts {
  const styles = getComputedStyle(canvas)
  return {
    sans: styles.getPropertyValue('--nx-font-sans').trim() || FALLBACK_SANS,
    mono: styles.getPropertyValue('--nx-font-mono').trim() || FALLBACK_MONO,
  }
}

function createFx(): PongFx {
  return {
    trail: [],
    particles: [],
    rings: [],
    previousBall: null,
    lastPlayerHits: 0,
    lastPlayerScore: 0,
    lastAiScore: 0,
  }
}

function captureFx(engine: PongEngine, fx: PongFx): void {
  const state = engine.state
  if (state.phase !== 'playing') {
    fx.previousBall = null
    fx.trail.length = 0
    fx.lastPlayerHits = state.playerHits
    fx.lastPlayerScore = state.playerScore
    fx.lastAiScore = state.aiScore
    return
  }

  const ball = state.ball
  if (fx.previousBall !== null) {
    const distance = Math.hypot(ball.x - fx.previousBall.x, ball.y - fx.previousBall.y)
    if (distance < 100) {
      fx.trail.unshift({ x: ball.x, y: ball.y, life: 0.38 })
    } else {
      fx.trail.length = 0
    }
  }
  fx.previousBall = { x: ball.x, y: ball.y }

  if (state.playerHits > fx.lastPlayerHits) {
    burst(fx, ball.x, state.player.y, PALETTE.blue, 10)
    ring(fx, ball.x, state.player.y, PALETTE.blue, 32)
  }
  if (state.playerScore > fx.lastPlayerScore) {
    burst(fx, ARENA.width / 2, ARENA.height - 42, PALETTE.blue, 16)
    ring(fx, ARENA.width / 2, ARENA.height / 2, PALETTE.blue, 84)
  }
  if (state.aiScore > fx.lastAiScore) {
    burst(fx, ARENA.width / 2, 42, PALETTE.orange, 16)
    ring(fx, ARENA.width / 2, ARENA.height / 2, PALETTE.orange, 84)
  }

  fx.lastPlayerHits = state.playerHits
  fx.lastPlayerScore = state.playerScore
  fx.lastAiScore = state.aiScore
}

function burst(fx: PongFx, x: number, y: number, color: string, count: number): void {
  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.35
    const speed = 24 + Math.random() * 46
    const maxLife = 0.32 + Math.random() * 0.22
    fx.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 1.5 + Math.random() * 2,
      life: maxLife,
      maxLife,
      color,
    })
  }
}

function ring(fx: PongFx, x: number, y: number, color: string, maxRadius: number): void {
  fx.rings.push({ x, y, color, life: 0.42, maxLife: 0.42, maxRadius })
}

function advanceFx(fx: PongFx, dt: number): void {
  for (let i = fx.trail.length - 1; i >= 0; i -= 1) {
    const dot = fx.trail[i]
    if (dot === undefined) continue
    dot.life -= dt
    if (dot.life <= 0) fx.trail.splice(i, 1)
  }
  if (fx.trail.length > 18) fx.trail.length = 18

  for (let i = fx.particles.length - 1; i >= 0; i -= 1) {
    const particle = fx.particles[i]
    if (particle === undefined) continue
    particle.x += particle.vx * dt
    particle.y += particle.vy * dt
    particle.vx *= 0.96
    particle.vy *= 0.96
    particle.life -= dt
    if (particle.life <= 0) fx.particles.splice(i, 1)
  }

  for (let i = fx.rings.length - 1; i >= 0; i -= 1) {
    const pulse = fx.rings[i]
    if (pulse === undefined) continue
    pulse.life -= dt
    if (pulse.life <= 0) fx.rings.splice(i, 1)
  }
}

function draw(
  ctx: CanvasRenderingContext2D,
  engine: PongEngine,
  time: number,
  viewport: GameViewport,
  fonts: PongFonts,
  fx: PongFx,
): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  const background = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height)
  background.addColorStop(0, '#fffdf9')
  background.addColorStop(0.52, '#faf7f2')
  background.addColorStop(1, '#f1e9dc')
  ctx.fillStyle = background
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)

  const sweep = (Math.sin(time * 0.45) + 1) / 2
  const ambient = ctx.createRadialGradient(
    ctx.canvas.width * (0.2 + sweep * 0.6),
    ctx.canvas.height * 0.45,
    0,
    ctx.canvas.width * (0.2 + sweep * 0.6),
    ctx.canvas.height * 0.45,
    ctx.canvas.width * 0.65,
  )
  ambient.addColorStop(0, withAlpha(PALETTE.orangeBright, 0.08))
  ambient.addColorStop(1, withAlpha(PALETTE.paper, 0))
  ctx.fillStyle = ambient
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)

  const scale = Math.min(viewport.width / ARENA.width, viewport.height / ARENA.height)
  const offsetX = (viewport.width - ARENA.width * scale) / 2
  const offsetY = (viewport.height - ARENA.height * scale) / 2
  ctx.setTransform(
    viewport.dpr * scale,
    0,
    0,
    viewport.dpr * scale,
    viewport.dpr * offsetX,
    viewport.dpr * offsetY,
  )

  if (engine.state.phase === 'config') {
    drawConfig(ctx, engine, fonts)
  } else if (engine.state.phase === 'loadout') {
    drawLoadout(ctx, engine, fonts)
  } else if (engine.state.phase === 'playing' || engine.state.phase === 'over') {
    drawArena(ctx, engine, time, fonts, fx)
  } else {
    drawArenaBackdrop(ctx, time, fonts)
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0)
}

function drawArenaBackdrop(ctx: CanvasRenderingContext2D, time: number, fonts: PongFonts): void {
  drawArenaGrid(ctx, time)
  setFont(ctx, 700, 10, fonts.mono)
  ctx.fillStyle = withAlpha(PALETTE.slate, 0.68)
  ctx.textAlign = 'left'
  ctx.fillText('NIXLABS // PONG', 20, 28)
  ctx.textAlign = 'right'
  ctx.fillText('READY', ARENA.width - 20, 28)
}

function drawArena(
  ctx: CanvasRenderingContext2D,
  engine: PongEngine,
  time: number,
  fonts: PongFonts,
  fx: PongFx,
): void {
  drawArenaGrid(ctx, time)
  drawPowerupTimers(ctx, engine, time)

  ctx.save()
  ctx.strokeStyle = withAlpha(PALETTE.lineStrong, 0.8)
  ctx.lineWidth = 1
  ctx.setLineDash([6, 8])
  ctx.beginPath()
  ctx.moveTo(16, ARENA.height / 2)
  ctx.lineTo(ARENA.width - 16, ARENA.height / 2)
  ctx.stroke()
  ctx.setLineDash([])

  ctx.strokeStyle = withAlpha(PALETTE.orangeBright, 0.17)
  ctx.beginPath()
  ctx.arc(ARENA.width / 2, ARENA.height / 2, 42 + Math.sin(time * 2) * 2, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()

  drawFx(ctx, fx)

  for (const candy of engine.state.candy) {
    if (candy.active) drawPongCandy(ctx, candy.x, candy.y, time)
  }

  const playerWidth = paddleWidth(engine.state.player)
  const aiWidth = paddleWidth(engine.state.ai)
  drawPaddle(ctx, engine.state.player.x, engine.state.player.y, playerWidth, engine.state.player.h, PALETTE.blue, PALETTE.blueDeep, time)
  drawPaddle(ctx, engine.state.ai.x, engine.state.ai.y, aiWidth, engine.state.ai.h, PALETTE.orange, PALETTE.orangeDeep, time + 1)

  if (engine.state.playerGlassWallActive && glassWallIsVisible(engine.state.playerGlassWallTimeRemaining, time)) {
    const wallGradient = ctx.createLinearGradient(0, engine.state.player.y, 0, engine.state.player.y + 18)
    wallGradient.addColorStop(0, withAlpha(PALETTE.blue, 0.05))
    wallGradient.addColorStop(0.5, withAlpha(PALETTE.blue, 0.32))
    wallGradient.addColorStop(1, withAlpha(PALETTE.blue, 0.02))
    ctx.fillStyle = wallGradient
    ctx.fillRect(0, engine.state.player.y + 9, ARENA.width, 18)
    ctx.strokeStyle = withAlpha(PALETTE.blue, 0.7)
    ctx.setLineDash([4, 6])
    ctx.beginPath()
    ctx.moveTo(0, engine.state.player.y + 10)
    ctx.lineTo(ARENA.width, engine.state.player.y + 10)
    ctx.stroke()
    ctx.setLineDash([])
  }

  drawBall(ctx, engine.state.ball.x, engine.state.ball.y, engine.state.ball.radius, time)
  if (engine.state.ball.stuckToPlayer) {
    drawMagnetPrompt(ctx, engine.state.ball.x, engine.state.ball.y, time, fonts)
  }
  drawNotifications(ctx, engine, fonts)
}

function drawArenaGrid(ctx: CanvasRenderingContext2D, time: number): void {
  ctx.save()
  for (let x = 30; x < ARENA.width; x += 30) {
    ctx.strokeStyle = withAlpha(PALETTE.line, x === 180 ? 0.32 : 0.2)
    ctx.lineWidth = x === 180 ? 1 : 0.6
    ctx.beginPath()
    ctx.moveTo(x, 14)
    ctx.lineTo(x, ARENA.height - 14)
    ctx.stroke()
  }
  for (let y = 40; y < ARENA.height; y += 40) {
    ctx.strokeStyle = withAlpha(PALETTE.line, 0.17)
    ctx.lineWidth = 0.6
    ctx.beginPath()
    ctx.moveTo(14, y)
    ctx.lineTo(ARENA.width - 14, y)
    ctx.stroke()
  }

  const pulse = 0.46 + Math.sin(time * 3) * 0.12
  ctx.strokeStyle = withAlpha(PALETTE.orangeBright, pulse)
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(18, 16)
  ctx.lineTo(62, 16)
  ctx.moveTo(ARENA.width - 62, ARENA.height - 16)
  ctx.lineTo(ARENA.width - 18, ARENA.height - 16)
  ctx.stroke()
  ctx.restore()
}

interface PowerupTimer {
  readonly type: PowerupType
  readonly timeRemaining: number
  readonly duration: number
}

function drawPowerupTimers(ctx: CanvasRenderingContext2D, engine: PongEngine, time: number): void {
  const playerTimers: PowerupTimer[] = engine.state.player.activePowerups.map((powerup) => ({
    type: powerup.type as PowerupType,
    timeRemaining: powerup.timeRemaining,
    duration: powerup.duration,
  }))
  if (engine.state.playerGlassWallActive) {
    playerTimers.push({
      type: 'glass-wall',
      timeRemaining: engine.state.playerGlassWallTimeRemaining,
      duration: POWERUP_DURATIONS['glass-wall'][engine.state.difficulty],
    })
  }

  const aiTimers: PowerupTimer[] = engine.state.ai.activePowerups.map((powerup) => ({
    type: powerup.type as PowerupType,
    timeRemaining: powerup.timeRemaining,
    duration: powerup.duration,
  }))
  for (let i = 0; i < playerTimers.length; i += 1) {
    const timer = playerTimers[i]
    if (timer !== undefined) drawPowerupTimer(ctx, timer, 474 - i * 4, 'bottom', time)
  }
  for (let i = 0; i < aiTimers.length; i += 1) {
    const timer = aiTimers[i]
    if (timer !== undefined) drawPowerupTimer(ctx, timer, 6 + i * 4, 'top', time)
  }
}

function drawPowerupTimer(
  ctx: CanvasRenderingContext2D,
  timer: PowerupTimer,
  y: number,
  side: 'top' | 'bottom',
  time: number,
): void {
  const left = 18
  const width = ARENA.width - 36
  const progress = Math.max(0, Math.min(1, timer.timeRemaining / timer.duration))
  const end = left + width * progress

  ctx.save()
  ctx.lineWidth = 1
  ctx.strokeStyle = withAlpha(PALETTE.orange, 0.14)
  ctx.beginPath()
  ctx.moveTo(left, y)
  ctx.lineTo(left + width, y)
  ctx.stroke()

  ctx.lineWidth = 2
  ctx.shadowColor = PALETTE.orange
  ctx.shadowBlur = 7
  ctx.strokeStyle = withAlpha(PALETTE.orangeBright, 0.95)
  ctx.beginPath()
  ctx.moveTo(left, y)
  ctx.lineTo(end, y)
  ctx.stroke()
  ctx.shadowColor = 'transparent'

  const spark = 1.8 + (Math.sin(time * 370 + y) + 1) * 0.55
  ctx.fillStyle = PALETTE.orangeBright
  ctx.beginPath()
  ctx.arc(end, y, spark, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = withAlpha(PALETTE.orangeBright, 0.72)
  ctx.lineWidth = 0.8
  for (let i = 0; i < 4; i += 1) {
    const angle = time * 19 + i * Math.PI / 2 + (side === 'top' ? 0 : Math.PI / 4)
    const ray = 3 + ((Math.sin(time * 41 + i) + 1) / 2) * 3
    ctx.beginPath()
    ctx.moveTo(end + Math.cos(angle) * 1.5, y + Math.sin(angle) * 1.5)
    ctx.lineTo(end + Math.cos(angle) * ray, y + Math.sin(angle) * ray)
    ctx.stroke()
  }
  ctx.restore()
}

function drawPowerupIcon(
  ctx: CanvasRenderingContext2D,
  type: PowerupType,
  x: number,
  y: number,
  size: number,
  color: string,
): void {
  const half = size / 2
  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = withAlpha(color, 0.16)
  ctx.lineWidth = Math.max(1, size * 0.12)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  if (type === 'speed') {
    ctx.beginPath()
    ctx.moveTo(x + half * 0.2, y - half)
    ctx.lineTo(x - half * 0.15, y - half * 0.05)
    ctx.lineTo(x + half * 0.15, y - half * 0.05)
    ctx.lineTo(x - half * 0.25, y + half)
    ctx.lineTo(x + half * 0.65, y - half * 0.28)
    ctx.lineTo(x + half * 0.2, y - half * 0.28)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  } else if (type === 'extension') {
    roundRectPath(ctx, x - half * 0.6, y - half * 0.22, size * 0.6, size * 0.44, 1.5)
    ctx.fill()
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x - half, y)
    ctx.lineTo(x - half * 0.55, y - half * 0.4)
    ctx.moveTo(x - half, y)
    ctx.lineTo(x - half * 0.55, y + half * 0.4)
    ctx.moveTo(x + half, y)
    ctx.lineTo(x + half * 0.55, y - half * 0.4)
    ctx.moveTo(x + half, y)
    ctx.lineTo(x + half * 0.55, y + half * 0.4)
    ctx.stroke()
  } else if (type === 'magnet') {
    ctx.beginPath()
    ctx.arc(x, y - half * 0.05, half * 0.65, 0.15 * Math.PI, 0.85 * Math.PI)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x - half * 0.65, y + half * 0.08)
    ctx.lineTo(x - half * 0.65, y + half * 0.52)
    ctx.moveTo(x + half * 0.65, y + half * 0.08)
    ctx.lineTo(x + half * 0.65, y + half * 0.52)
    ctx.stroke()
    ctx.fillStyle = color
    ctx.fillRect(x - half * 0.82, y + half * 0.35, half * 0.34, half * 0.28)
    ctx.fillRect(x + half * 0.48, y + half * 0.35, half * 0.34, half * 0.28)
  } else {
    ctx.beginPath()
    ctx.moveTo(x, y - half)
    ctx.lineTo(x + half * 0.72, y - half * 0.62)
    ctx.lineTo(x + half * 0.58, y + half * 0.55)
    ctx.lineTo(x, y + half)
    ctx.lineTo(x - half * 0.58, y + half * 0.55)
    ctx.lineTo(x - half * 0.72, y - half * 0.62)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x - half * 0.35, y - half * 0.45)
    ctx.lineTo(x + half * 0.05, y - half * 0.08)
    ctx.lineTo(x - half * 0.18, y + half * 0.28)
    ctx.moveTo(x + half * 0.05, y - half * 0.08)
    ctx.lineTo(x + half * 0.4, y - half * 0.32)
    ctx.stroke()
  }
  ctx.restore()
}

function drawFx(ctx: CanvasRenderingContext2D, fx: PongFx): void {
  ctx.save()
  for (const dot of fx.trail) {
    const alpha = Math.max(0, Math.min(1, dot.life / 0.38)) * 0.28
    ctx.fillStyle = withAlpha(PALETTE.red, alpha)
    ctx.beginPath()
    ctx.arc(dot.x, dot.y, 2 + dot.life * 7, 0, Math.PI * 2)
    ctx.fill()
  }

  for (const pulse of fx.rings) {
    const progress = 1 - pulse.life / pulse.maxLife
    ctx.strokeStyle = withAlpha(pulse.color, Math.max(0, pulse.life / pulse.maxLife) * 0.55)
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(pulse.x, pulse.y, progress * pulse.maxRadius, 0, Math.PI * 2)
    ctx.stroke()
  }

  for (const particle of fx.particles) {
    ctx.fillStyle = withAlpha(particle.color, Math.max(0, particle.life / particle.maxLife))
    ctx.beginPath()
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function drawPaddle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
  deepColor: string,
  time: number,
): void {
  const left = x - width / 2
  const top = y - height / 2
  ctx.save()
  ctx.shadowColor = withAlpha(color, 0.3)
  ctx.shadowBlur = 14
  ctx.shadowOffsetY = 3
  roundRectPath(ctx, left, top, width, height, 5)
  const gradient = ctx.createLinearGradient(left, top, left, top + height)
  gradient.addColorStop(0, color)
  gradient.addColorStop(0.46, color)
  gradient.addColorStop(1, deepColor)
  ctx.fillStyle = gradient
  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.lineWidth = 1
  ctx.strokeStyle = withAlpha(deepColor, 0.92)
  ctx.stroke()

  ctx.globalAlpha = 0.75 + Math.sin(time * 4) * 0.12
  roundRectPath(ctx, left + 3, top + 2, width - 6, 2, 1)
  ctx.fillStyle = '#fffdf9'
  ctx.fill()
  ctx.globalAlpha = 1

  ctx.fillStyle = withAlpha('#fffdf9', 0.3)
  for (let i = 0; i < 3; i += 1) {
    roundRectPath(ctx, left + width * (0.25 + i * 0.25) - 2, top + height / 2 - 1, 4, 2, 1)
    ctx.fill()
  }
  ctx.restore()
}

function drawBall(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, time: number): void {
  ctx.save()
  ctx.shadowColor = withAlpha(PALETTE.red, 0.68)
  ctx.shadowBlur = 18 + Math.sin(time * 5) * 3
  const gradient = ctx.createRadialGradient(x - 1.5, y - 2, 0.5, x, y, radius * 1.7)
  gradient.addColorStop(0, '#fffdf9')
  gradient.addColorStop(0.26, PALETTE.orangeBright)
  gradient.addColorStop(0.7, PALETTE.red)
  gradient.addColorStop(1, PALETTE.redDeep)
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(x, y, radius + 1, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.lineWidth = 1
  ctx.strokeStyle = withAlpha(PALETTE.redDeep, 0.9)
  ctx.stroke()

  ctx.strokeStyle = withAlpha('#fffdf9', 0.75)
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(x, y, radius + 4, time, time + Math.PI * 1.25)
  ctx.stroke()
  ctx.fillStyle = '#fffdf9'
  ctx.globalAlpha = 0.86
  ctx.beginPath()
  ctx.arc(x - 1.7, y - 1.8, 1.35, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function glassWallIsVisible(timeRemaining: number, time: number): boolean {
  if (timeRemaining > 2.4) return true
  const flicker = Math.sin(time * 37.7) + Math.sin(time * 83.1) * 0.55 + Math.sin(time * 127.3) * 0.3
  return flicker > -0.15
}

function drawMagnetPrompt(ctx: CanvasRenderingContext2D, x: number, y: number, time: number, fonts: PongFonts): void {
  const width = 210
  const height = 38
  const left = Math.max(12, Math.min(ARENA.width - width - 12, x - width / 2))
  const top = Math.max(24, y - 58)
  ctx.save()
  ctx.globalAlpha = 0.94 + Math.sin(time * 4) * 0.04
  roundRectPath(ctx, left, top, width, height, 8)
  ctx.fillStyle = withAlpha(PALETTE.blueDeep, 0.94)
  ctx.fill()
  ctx.strokeStyle = withAlpha(PALETTE.blue, 0.9)
  ctx.stroke()
  setFont(ctx, 800, 9, fonts.mono)
  ctx.fillStyle = PALETTE.card
  ctx.textAlign = 'center'
  ctx.fillText('MAGNET LOCKED', left + width / 2, top + 14)
  setFont(ctx, 650, 8, fonts.sans)
  ctx.fillStyle = withAlpha(PALETTE.card, 0.9)
  ctx.fillText('CLICK · TAP · SPACE TO RELEASE', left + width / 2, top + 28)
  ctx.restore()
}

function drawNotifications(ctx: CanvasRenderingContext2D, engine: PongEngine, fonts: PongFonts): void {
  setFont(ctx, 800, 11, fonts.mono)
  ctx.textAlign = 'center'
  for (const notification of engine.state.notifications) {
    ctx.fillStyle = withAlpha(PALETTE.ink, Math.min(1, notification.time) * 0.86)
    ctx.fillText(notification.text, ARENA.width / 2, notification.y)
  }
}

function drawConfig(ctx: CanvasRenderingContext2D, engine: PongEngine, fonts: PongFonts): void {
  drawPanel(ctx, 18, 18, ARENA.width - 36, ARENA.height - 36)
  setFont(ctx, 750, 21, fonts.sans)
  ctx.fillStyle = PALETTE.ink
  ctx.textAlign = 'center'
  ctx.fillText('Game Settings', ARENA.width / 2, 52)
  setFont(ctx, 700, 10, fonts.mono)
  ctx.fillStyle = PALETTE.slate
  ctx.fillText('MATCH CONFIGURATION', ARENA.width / 2, 70)

  drawSectionLabel(ctx, 'POINTS TO WIN', 40, 93, fonts.mono)
  const modes = [11, 21, 30] as const
  for (let i = 0; i < modes.length; i += 1) {
    const mode = modes[i]
    if (mode === undefined) continue
    drawChoice(ctx, 40 + i * 100, 103, 80, 38, mode.toString(), engine.state.mode === mode, fonts.sans)
  }

  drawSectionLabel(ctx, 'DIFFICULTY', 40, 180, fonts.mono)
  const difficulties = [
    { value: 'easy', label: 'Easy', width: 60 },
    { value: 'normal', label: 'Normal', width: 80 },
    { value: 'hard', label: 'Hard', width: 60 },
  ] as const
  let x = 40
  for (const difficulty of difficulties) {
    drawChoice(ctx, x, 200, difficulty.width, 38, difficulty.label, engine.state.difficulty === difficulty.value, fonts.sans)
    x += difficulty.width + 20
  }

  if (engine.isVeryHardUnlocked()) {
    drawChoice(ctx, 40, 250, 140, 38, 'Very Hard', engine.state.difficulty === 'very-hard', fonts.sans)
  }

  drawButton(ctx, ARENA.width / 2 - 50, ARENA.height - 80, 100, 40, 'Next', PALETTE.blue, PALETTE.blueDeep, fonts.sans)
}

function drawLoadout(ctx: CanvasRenderingContext2D, engine: PongEngine, fonts: PongFonts): void {
  drawPanel(ctx, 18, 18, ARENA.width - 36, ARENA.height - 36)
  setFont(ctx, 750, 21, fonts.sans)
  ctx.fillStyle = PALETTE.ink
  ctx.textAlign = 'center'
  ctx.fillText('Pre-Match Shop', ARENA.width / 2, 52)
  setFont(ctx, 650, 11, fonts.mono)
  ctx.fillStyle = PALETTE.orangeDeep
  ctx.fillText(`CANDY AVAILABLE  ${engine.deps.current.bonus}`, ARENA.width / 2, 72)

  for (const item of SHOP_ITEMS) {
    const y = itemYFor(item.type)
    drawShopItem(ctx, y, item.type, item.name, `${COSTS[item.type]} C`, fonts)
  }

  drawSectionLabel(ctx, `YOUR LOADOUT  ·  KEYS 1-${engine.state.slots.length}`, 40, 318, fonts.mono)
  const slotWidth = 30
  const gap = 10
  const totalWidth = engine.state.slots.length * slotWidth + (engine.state.slots.length - 1) * gap
  let slotX = (ARENA.width - totalWidth) / 2
  for (let i = 0; i < engine.state.slots.length; i += 1) {
    const slot = engine.state.slots[i]
    if (slot === undefined) continue
    roundRectPath(ctx, slotX, 340, slotWidth, slotWidth, 5)
    ctx.fillStyle = slot === null ? withAlpha(PALETTE.card, 0.72) : PALETTE.blueTint
    ctx.fill()
    ctx.strokeStyle = slot === null ? PALETTE.lineStrong : PALETTE.blue
    ctx.stroke()
    if (slot !== null) {
      drawPowerupIcon(ctx, slot, slotX + slotWidth / 2, 355, 10, PALETTE.blueDeep)
    }
    slotX += slotWidth + gap
  }

  drawButton(ctx, ARENA.width / 2 - 50, ARENA.height - 80, 100, 40, 'Ready', PALETTE.orange, PALETTE.orangeDeep, fonts.sans)
}

function drawPanel(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number): void {
  ctx.save()
  ctx.shadowColor = 'rgba(35, 35, 36, 0.12)'
  ctx.shadowBlur = 24
  ctx.shadowOffsetY = 8
  roundRectPath(ctx, x, y, width, height, 14)
  ctx.fillStyle = withAlpha(PALETTE.card, 0.94)
  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.strokeStyle = PALETTE.line
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.restore()
}

function drawSectionLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, font: string): void {
  setFont(ctx, 750, 10, font)
  ctx.fillStyle = PALETTE.slate
  ctx.textAlign = 'left'
  ctx.fillText(text, x, y)
}

function drawChoice(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  selected: boolean,
  font: string,
  disabled = false,
): void {
  roundRectPath(ctx, x, y, width, height, 7)
  ctx.fillStyle = disabled ? withAlpha(PALETTE.sand, 0.58) : selected ? PALETTE.orange : PALETTE.card
  ctx.fill()
  ctx.strokeStyle = disabled ? PALETTE.line : selected ? PALETTE.orangeDeep : PALETTE.lineStrong
  ctx.stroke()
  setFont(ctx, 700, 13, font)
  ctx.fillStyle = disabled ? PALETTE.slate : selected ? PALETTE.card : PALETTE.ink
  ctx.textAlign = 'center'
  ctx.fillText(label, x + width / 2, y + 24)
}

function drawButton(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  color: string,
  deepColor: string,
  font: string,
): void {
  roundRectPath(ctx, x, y, width, height, 8)
  const gradient = ctx.createLinearGradient(x, y, x, y + height)
  gradient.addColorStop(0, color)
  gradient.addColorStop(1, deepColor)
  ctx.fillStyle = gradient
  ctx.fill()
  ctx.strokeStyle = deepColor
  ctx.stroke()
  setFont(ctx, 750, 14, font)
  ctx.fillStyle = PALETTE.card
  ctx.textAlign = 'center'
  ctx.fillText(label, x + width / 2, y + 25)
}

function drawShopItem(
  ctx: CanvasRenderingContext2D,
  y: number,
  type: PowerupType,
  name: string,
  cost: string,
  fonts: PongFonts,
): void {
  roundRectPath(ctx, 40, y, ARENA.width - 80, 40, 7)
  ctx.fillStyle = PALETTE.card
  ctx.fill()
  ctx.strokeStyle = PALETTE.line
  ctx.stroke()
  drawPowerupIcon(ctx, type, 57, y + 20, 9, PALETTE.orangeDeep)
  setFont(ctx, 650, 13, fonts.sans)
  ctx.fillStyle = PALETTE.ink
  ctx.textAlign = 'left'
  ctx.fillText(name, 72, y + 25)
  setFont(ctx, 750, 11, fonts.mono)
  ctx.fillStyle = PALETTE.orangeDeep
  ctx.textAlign = 'right'
  ctx.fillText(cost, ARENA.width - 52, y + 25)
}

function setFont(ctx: CanvasRenderingContext2D, weight: number, size: number, family: string): void {
  ctx.font = `${weight} ${size}px ${family}`
}

function itemYFor(type: PowerupType): number {
  switch (type) {
    case 'speed':
      return 100
    case 'extension':
      return 150
    case 'magnet':
      return 200
    case 'glass-wall':
      return 250
  }
}

function paddleWidth(paddle: { readonly w: number; readonly activePowerups: readonly { readonly type: string }[] }): number {
  return paddle.w * extensionScale(paddle.activePowerups)
}
