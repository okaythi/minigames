import { AI_CONFIGS, ARENA } from '../engine/config'
import type { TronEngine } from '../engine/engine'
import type { TronFonts } from './types'
import { PALETTE, withAlpha } from '../../../theme/palette'
import { roundRectPath, setCanvasFont } from '../../../lib/canvas'
import { formatRunTime } from '../view-model'

export function drawMainMenu(ctx: CanvasRenderingContext2D, fonts: TronFonts): void {
  drawBackdropDim(ctx)

  const panelW = 400
  const panelH = 500
  const panelX = (ARENA.width - panelW) / 2
  const panelY = (ARENA.height - panelH) / 2

  drawGlassPanel(ctx, panelX, panelY, panelW, panelH)

  // Title & Header
  setCanvasFont(ctx, 900, 26, fonts.mono)
  ctx.fillStyle = PALETTE.ink
  ctx.textAlign = 'center'
  ctx.fillText('FL TRON 3.0', ARENA.width / 2, panelY + 48)

  setCanvasFont(ctx, 700, 9.5, fonts.mono)
  ctx.fillStyle = PALETTE.orangeDeep
  ctx.fillText('CYBER LIGHT CYCLE DUEL // NIXLABS', ARENA.width / 2, panelY + 68)

  // Mode Selection Cards
  const cardW = panelW - 40
  const cardH = 76
  const cardX = panelX + 20
  let cardY = panelY + 92

  // 1. Campaign Mode (Active)
  drawModeCard(
    ctx,
    cardX,
    cardY,
    cardW,
    cardH,
    'SINGLE PLAYER CAMPAIGN',
    'Battle 6 escalating tactical AI archetypes. First to 3 wins.',
    'ACTIVE',
    true,
    fonts,
  )

  cardY += cardH + 16

  // 2. Local VS (2 Players) (Coming Soon)
  drawModeCard(
    ctx,
    cardX,
    cardY,
    cardW,
    cardH,
    'LOCAL VS (2 PLAYERS)',
    'Split-keyboard duel (P1: Arrows+Ctrl · P2: WASD+Space).',
    'COMING SOON',
    false,
    fonts,
  )

  cardY += cardH + 16

  // 3. Online Multiplayer (Coming Soon)
  drawModeCard(
    ctx,
    cardX,
    cardY,
    cardW,
    cardH,
    'ONLINE MULTIPLAYER',
    'Real-time low-latency edge arenas over WebSockets.',
    'COMING SOON',
    false,
    fonts,
  )

  // Start Launch Button
  const btnW = 240
  const btnH = 46
  const btnX = (ARENA.width - btnW) / 2
  const btnY = panelY + panelH - 68

  drawPrimaryButton(ctx, btnX, btnY, btnW, btnH, 'START CAMPAIGN', PALETTE.blue, PALETTE.blueDeep, fonts)

  setCanvasFont(ctx, 650, 9, fonts.mono)
  ctx.fillStyle = withAlpha(PALETTE.slate, 0.8)
  ctx.fillText('PRESS ENTER OR CLICK TO START', ARENA.width / 2, btnY + btnH + 16)
}

export function drawIntermission(
  ctx: CanvasRenderingContext2D,
  engine: TronEngine,
  fonts: TronFonts,
): void {
  drawBackdropDim(ctx)

  const panelW = 400
  const panelH = 420
  const panelX = (ARENA.width - panelW) / 2
  const panelY = (ARENA.height - panelH) / 2

  drawGlassPanel(ctx, panelX, panelY, panelW, panelH)

  // Level Cleared Banner
  setCanvasFont(ctx, 800, 11, fonts.mono)
  ctx.fillStyle = PALETTE.greenDeep
  ctx.textAlign = 'center'
  ctx.fillText(`LEVEL ${engine.state.level} DEFEATED`, ARENA.width / 2, panelY + 42)

  setCanvasFont(ctx, 900, 22, fonts.mono)
  ctx.fillStyle = PALETTE.ink
  ctx.fillText('SECTOR SECURED', ARENA.width / 2, panelY + 70)

  // Next Opponent Briefing Card
  const nextLevel = Math.min(6, engine.state.level + 1) as 1 | 2 | 3 | 4 | 5 | 6
  const nextConfig = AI_CONFIGS[nextLevel]

  const cardX = panelX + 24
  const cardY = panelY + 98
  const cardW = panelW - 48
  const cardH = 180

  roundRectPath(ctx, cardX, cardY, cardW, cardH, 8)
  ctx.fillStyle = withAlpha(PALETTE.sand, 0.4)
  ctx.fill()
  ctx.strokeStyle = PALETTE.line
  ctx.stroke()

  setCanvasFont(ctx, 750, 9.5, fonts.mono)
  ctx.fillStyle = PALETTE.orangeDeep
  ctx.textAlign = 'left'
  ctx.fillText(`NEXT TARGET // LEVEL ${nextLevel}`, cardX + 16, cardY + 28)

  setCanvasFont(ctx, 800, 18, fonts.mono)
  ctx.fillStyle = PALETTE.ink
  ctx.fillText(nextConfig.name.toUpperCase(), cardX + 16, cardY + 54)

  setCanvasFont(ctx, 650, 11, fonts.sans)
  ctx.fillStyle = PALETTE.slate
  ctx.fillText(nextConfig.tagline, cardX + 16, cardY + 74)

  // 1-Sentence Lore / Description
  ctx.fillStyle = PALETTE.ink
  drawWrappedText(ctx, nextConfig.description, cardX + 16, cardY + 104, cardW - 32, 16, fonts.sans)

  // Speedrun Time Decal
  setCanvasFont(ctx, 700, 10, fonts.mono)
  ctx.fillStyle = PALETTE.slate
  ctx.textAlign = 'center'
  ctx.fillText(`CURRENT RUN TIME: ${formatRunTime(engine.state.elapsedRunSeconds)}`, ARENA.width / 2, cardY + cardH + 26)

  // Continue Button
  const btnW = 220
  const btnH = 44
  const btnX = (ARENA.width - btnW) / 2
  const btnY = panelY + panelH - 64

  drawPrimaryButton(ctx, btnX, btnY, btnW, btnH, 'CONTINUE', PALETTE.orange, PALETTE.orangeDeep, fonts)
}

export function drawRoundOverlay(
  ctx: CanvasRenderingContext2D,
  engine: TronEngine,
  fonts: TronFonts,
): void {
  if (engine.state.bannerText) {
    const bannerW = 340
    const bannerH = 64
    const bannerX = (ARENA.width - bannerW) / 2
    const bannerY = ARENA.height * 0.42

    drawGlassPanel(ctx, bannerX, bannerY, bannerW, bannerH)

    setCanvasFont(ctx, 900, 17, fonts.mono)
    ctx.fillStyle = PALETTE.ink
    ctx.textAlign = 'center'
    ctx.fillText(engine.state.bannerText, ARENA.width / 2, bannerY + 28)

    if (engine.state.bannerSubtext) {
      setCanvasFont(ctx, 650, 10, fonts.mono)
      ctx.fillStyle = PALETTE.slate
      ctx.fillText(engine.state.bannerSubtext, ARENA.width / 2, bannerY + 48)
    }
  }

  if (engine.state.phase === 'countdown' && engine.state.countdownTimer > 0) {
    const count = Math.ceil(engine.state.countdownTimer)
    const label = count > 0 && count <= 3 ? String(count) : 'GO!'
    setCanvasFont(ctx, 900, 48, fonts.mono)
    ctx.fillStyle = withAlpha(PALETTE.ink, 0.85)
    ctx.textAlign = 'center'
    ctx.fillText(label, ARENA.width / 2, ARENA.height * 0.35)
  }
}

export function drawGameOverOrVictory(
  ctx: CanvasRenderingContext2D,
  engine: TronEngine,
  fonts: TronFonts,
): void {
  drawBackdropDim(ctx)

  const isWin = engine.state.phase === 'victory'
  const panelW = 380
  const panelH = 360
  const panelX = (ARENA.width - panelW) / 2
  const panelY = (ARENA.height - panelH) / 2

  drawGlassPanel(ctx, panelX, panelY, panelW, panelH)

  setCanvasFont(ctx, 800, 11, fonts.mono)
  ctx.fillStyle = isWin ? PALETTE.greenDeep : PALETTE.redDeep
  ctx.textAlign = 'center'
  ctx.fillText(isWin ? 'MISSION ACCOMPLISHED' : 'GRID ELIMINATION', ARENA.width / 2, panelY + 44)

  setCanvasFont(ctx, 900, 24, fonts.mono)
  ctx.fillStyle = PALETTE.ink
  ctx.fillText(isWin ? 'CAMPAIGN VICTOR' : 'GAME OVER', ARENA.width / 2, panelY + 76)

  setCanvasFont(ctx, 650, 12, fonts.sans)
  ctx.fillStyle = PALETTE.graphite
  const sub = isWin
    ? 'You mastered all 6 cyber levels of FL Tron 3.0!'
    : `Defeated by Level ${engine.state.level} (${AI_CONFIGS[engine.state.level].name}).`
  ctx.fillText(sub, ARENA.width / 2, panelY + 104)

  // Stats Card
  const statsY = panelY + 124
  roundRectPath(ctx, panelX + 24, statsY, panelW - 48, 80, 8)
  ctx.fillStyle = withAlpha(PALETTE.sand, 0.45)
  ctx.fill()
  ctx.strokeStyle = PALETTE.line
  ctx.stroke()

  setCanvasFont(ctx, 700, 10, fonts.mono)
  ctx.fillStyle = PALETTE.slate
  ctx.textAlign = 'left'
  ctx.fillText('FINAL TIME', panelX + 44, statsY + 32)
  ctx.fillText('LEVEL REACHED', panelX + 44, statsY + 60)

  setCanvasFont(ctx, 800, 13, fonts.mono)
  ctx.fillStyle = PALETTE.ink
  ctx.textAlign = 'right'
  ctx.fillText(formatRunTime(engine.state.elapsedRunSeconds), panelX + panelW - 44, statsY + 32)
  ctx.fillText(`${engine.state.level} / 6`, panelX + panelW - 44, statsY + 60)

  // Restart button
  const btnW = 200
  const btnH = 44
  const btnX = (ARENA.width - btnW) / 2
  const btnY = panelY + panelH - 64

  drawPrimaryButton(ctx, btnX, btnY, btnW, btnH, 'PLAY AGAIN', PALETTE.blue, PALETTE.blueDeep, fonts)
}

function drawModeCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  title: string,
  desc: string,
  badge: string,
  isActive: boolean,
  fonts: TronFonts,
): void {
  roundRectPath(ctx, x, y, w, h, 8)
  ctx.fillStyle = isActive ? PALETTE.card : withAlpha(PALETTE.sand, 0.38)
  ctx.fill()
  ctx.strokeStyle = isActive ? PALETTE.blue : PALETTE.line
  ctx.lineWidth = isActive ? 1.8 : 1
  ctx.stroke()

  // Title
  setCanvasFont(ctx, 800, 12, fonts.mono)
  ctx.fillStyle = isActive ? PALETTE.ink : PALETTE.slate
  ctx.textAlign = 'left'
  ctx.fillText(title, x + 16, y + 26)

  // Badge
  const badgeW = isActive ? 56 : 90
  const badgeH = 18
  const badgeX = x + w - badgeW - 14
  const badgeY = y + 12
  roundRectPath(ctx, badgeX, badgeY, badgeW, badgeH, 4)
  ctx.fillStyle = isActive ? PALETTE.blueTint : withAlpha(PALETTE.sand, 0.8)
  ctx.fill()
  ctx.strokeStyle = isActive ? PALETTE.blue : PALETTE.lineStrong
  ctx.stroke()

  setCanvasFont(ctx, 800, 8, fonts.mono)
  ctx.fillStyle = isActive ? PALETTE.blueDeep : PALETTE.slate
  ctx.textAlign = 'center'
  ctx.fillText(badge, badgeX + badgeW / 2, badgeY + 12)

  // Description
  setCanvasFont(ctx, 600, 10, fonts.sans)
  ctx.fillStyle = isActive ? PALETTE.graphite : withAlpha(PALETTE.slate, 0.7)
  ctx.textAlign = 'left'
  ctx.fillText(desc, x + 16, y + 54)
}

function drawGlassPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  ctx.save()
  ctx.shadowColor = 'rgba(35, 35, 36, 0.16)'
  ctx.shadowBlur = 28
  ctx.shadowOffsetY = 10
  roundRectPath(ctx, x, y, w, h, 14)
  ctx.fillStyle = withAlpha(PALETTE.card, 0.96)
  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.strokeStyle = PALETTE.lineStrong
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.restore()
}

function drawBackdropDim(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = withAlpha(PALETTE.paper, 0.68)
  ctx.fillRect(0, 0, ARENA.width, ARENA.height)
}

function drawPrimaryButton(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  color: string,
  deepColor: string,
  fonts: TronFonts,
): void {
  ctx.save()
  roundRectPath(ctx, x, y, w, h, 8)
  const grad = ctx.createLinearGradient(x, y, x, y + h)
  grad.addColorStop(0, color)
  grad.addColorStop(1, deepColor)
  ctx.fillStyle = grad
  ctx.fill()
  ctx.strokeStyle = deepColor
  ctx.lineWidth = 1
  ctx.stroke()

  setCanvasFont(ctx, 800, 13, fonts.mono)
  ctx.fillStyle = '#fffdf9'
  ctx.textAlign = 'center'
  ctx.fillText(label, x + w / 2, y + h / 2 + 5)
  ctx.restore()
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  fontFamily: string,
): void {
  setCanvasFont(ctx, 600, 11, fontFamily)
  const words = text.split(' ')
  let line = ''
  let currentY = y

  for (let n = 0; n < words.length; n += 1) {
    const testLine = line + (words[n] ?? '') + ' '
    const metrics = ctx.measureText(testLine)
    const testWidth = metrics.width
    if (testWidth > maxWidth && n > 0) {
      ctx.fillText(line, x, currentY)
      line = (words[n] ?? '') + ' '
      currentY += lineHeight
    } else {
      line = testLine
    }
  }
  ctx.fillText(line, x, currentY)
}
