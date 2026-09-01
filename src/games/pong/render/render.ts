import type { GameHost } from '../../runtime/types'
import type { PongEngine } from '../engine/engine'
import { ARENA, COSTS } from '../engine/config'

export function attachPongRender(engine: PongEngine, host: GameHost) {
  const { canvas, context, onFrame } = host

  let lastTime = performance.now()
  
  const tick = () => {
    const now = performance.now()
    const dt = Math.min((now - lastTime) / 1000, 0.1)
    lastTime = now

    engine.update(dt)
    draw(context, engine)
  }
  
  const frameSub = onFrame(tick)
  
  const getPointer = (e: MouseEvent | TouchEvent) => {
    const rect = canvas.getBoundingClientRect()
    const touches = 'touches' in e ? (e as unknown as TouchEvent).touches : null
    const clientX = touches ? touches[0]?.clientX ?? 0 : (e as MouseEvent).clientX
    const scaleX = canvas.width / rect.width
    return (clientX - rect.left) * scaleX * (ARENA.width / canvas.width)
  }
  
  const getPointerY = (e: MouseEvent | TouchEvent) => {
    const rect = canvas.getBoundingClientRect()
    const touches = 'touches' in e ? (e as unknown as TouchEvent).touches : null
    const clientY = touches ? touches[0]?.clientY ?? 0 : (e as MouseEvent).clientY
    const scaleY = canvas.height / rect.height
    return (clientY - rect.top) * scaleY * (ARENA.height / canvas.height)
  }

  const onPointerDown = (e: MouseEvent | TouchEvent) => {
    engine.pointerDown = true
    const x = getPointer(e)
    const y = getPointerY(e)
    engine.pointerX = x
    
    if (e.cancelable && e.type === 'touchstart') e.preventDefault()
    
    if (engine.state.phase === 'config') {
       // Mode select
       if (y >= 100 && y <= 140) {
          if (x >= 40 && x <= 120) engine.state.mode = 11
          else if (x >= 140 && x <= 220) engine.state.mode = 21
          else if (x >= 240 && x <= 320) engine.state.mode = 30
       }
       
       // Difficulty select
       if (y >= 200 && y <= 240) {
          if (x >= 40 && x <= 100) engine.state.difficulty = 'easy'
          else if (x >= 120 && x <= 200) engine.state.difficulty = 'normal'
          else if (x >= 220 && x <= 280) engine.state.difficulty = 'hard'
       }
       if (y >= 250 && y <= 290) {
          if (x >= 40 && x <= 180 && (engine.deps.current.best || 0) >= 3) {
             engine.state.difficulty = 'very-hard'
          }
       }
       
       // Next button
       if (x >= ARENA.width/2 - 50 && x <= ARENA.width/2 + 50 && y >= ARENA.height - 80 && y <= ARENA.height - 40) {
          engine.confirmConfig()
       }
       return
    }
    
    if (engine.state.phase === 'loadout') {
       if (x >= ARENA.width/2 - 50 && x <= ARENA.width/2 + 50 && y >= ARENA.height - 80 && y <= ARENA.height - 40) {
          engine.startMatch()
          return
       }
       
       const yOffsets = { 'speed': 100, 'extension': 150, 'magnet': 200, 'glass-wall': 250 }
       for (const [type, itemY] of Object.entries(yOffsets)) {
          if (x >= 40 && x <= ARENA.width - 40 && y >= itemY && y <= itemY + 40) {
             const cost = (COSTS as any)[type]
             const emptyIdx = engine.state.slots.indexOf(null)
             if (emptyIdx !== -1 && engine.deps.current.bonus >= cost) {
                engine.deps.current.bankBonus(-cost)
                engine.state.slots[emptyIdx] = type as any
             }
          }
       }
    }
  }

  const onPointerMove = (e: MouseEvent | TouchEvent) => {
    if (engine.pointerDown || engine.state.phase === 'playing') {
      engine.pointerX = getPointer(e)
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
    }
  }
}

function draw(ctx: CanvasRenderingContext2D, engine: PongEngine) {
  ctx.fillStyle = '#faf7f2'
  ctx.fillRect(0, 0, ARENA.width, ARENA.height)
  
  if (engine.state.phase === 'config') {
    ctx.fillStyle = '#232324'
    ctx.textAlign = 'center'
    ctx.font = 'bold 20px Inter'
    ctx.fillText('Game Settings', ARENA.width/2, 40)
    
    ctx.font = 'bold 16px Inter'
    ctx.textAlign = 'left'
    ctx.fillText('Mode (Points to win)', 40, 90)
    
    const modes = [11, 21, 30]
    let mx = 40
    for (const m of modes) {
       ctx.fillStyle = engine.state.mode === m ? '#f6821f' : '#fffdf9'
       ctx.fillRect(mx, 100, 80, 40)
       ctx.strokeStyle = '#e6e0d6'
       ctx.strokeRect(mx, 100, 80, 40)
       ctx.fillStyle = engine.state.mode === m ? '#fffdf9' : '#232324'
       ctx.textAlign = 'center'
       ctx.fillText(m.toString(), mx + 40, 125)
       mx += 100
    }
    
    ctx.fillStyle = '#232324'
    ctx.textAlign = 'left'
    ctx.fillText('Difficulty', 40, 190)
    
    const diffs = [{d: 'easy', l: 'Easy', w: 60}, {d: 'normal', l: 'Normal', w: 80}, {d: 'hard', l: 'Hard', w: 60}]
    let dx = 40
    for (const df of diffs) {
       ctx.fillStyle = engine.state.difficulty === df.d ? '#f6821f' : '#fffdf9'
       ctx.fillRect(dx, 200, df.w, 40)
       ctx.strokeStyle = '#e6e0d6'
       ctx.strokeRect(dx, 200, df.w, 40)
       ctx.fillStyle = engine.state.difficulty === df.d ? '#fffdf9' : '#232324'
       ctx.textAlign = 'center'
       ctx.fillText(df.l, dx + df.w/2, 225)
       dx += df.w + 20
    }
    
    const vhUnlocked = (engine.deps.current.best || 0) >= 3
    ctx.fillStyle = engine.state.difficulty === 'very-hard' ? '#f6821f' : '#fffdf9'
    ctx.globalAlpha = vhUnlocked ? 1 : 0.5
    ctx.fillRect(40, 250, 140, 40)
    ctx.strokeStyle = '#e6e0d6'
    ctx.strokeRect(40, 250, 140, 40)
    ctx.fillStyle = engine.state.difficulty === 'very-hard' ? '#fffdf9' : '#232324'
    ctx.textAlign = 'center'
    ctx.fillText(vhUnlocked ? 'Very Hard' : 'Locked', 110, 275)
    ctx.globalAlpha = 1
    
    // Next
    ctx.fillStyle = '#1f6fd1'
    ctx.fillRect(ARENA.width/2 - 50, ARENA.height - 80, 100, 40)
    ctx.fillStyle = '#fffdf9'
    ctx.font = 'bold 16px Inter'
    ctx.fillText('Next', ARENA.width/2, ARENA.height - 55)
    
  } else if (engine.state.phase === 'loadout') {
    ctx.fillStyle = '#232324'
    ctx.textAlign = 'center'
    ctx.font = 'bold 20px Inter'
    ctx.fillText('Pre-Match Shop', ARENA.width/2, 40)
    
    ctx.font = '14px Inter'
    ctx.fillText('Candy available: ' + engine.deps.current.bonus, ARENA.width/2, 65)
    
    const shop = [
      { t: 'speed', name: 'Speed Boost' },
      { t: 'extension', name: 'Paddle Ext.' },
      { t: 'magnet', name: 'Magnet' },
      { t: 'glass-wall', name: 'Glass Wall' },
    ]
    const yOffsets = { 'speed': 100, 'extension': 150, 'magnet': 200, 'glass-wall': 250 }
    
    for (const item of shop) {
       const y = (yOffsets as any)[item.t]
       ctx.fillStyle = '#fffdf9'
       ctx.fillRect(40, y, ARENA.width - 80, 40)
       ctx.strokeStyle = '#e6e0d6'
       ctx.strokeRect(40, y, ARENA.width - 80, 40)
       
       ctx.fillStyle = '#232324'
       ctx.textAlign = 'left'
       ctx.fillText(item.name, 50, y + 25)
       ctx.textAlign = 'right'
       ctx.fillText((COSTS as any)[item.t] + ' C', ARENA.width - 50, y + 25)
    }
    
    ctx.textAlign = 'center'
    ctx.fillText('Your Loadout', ARENA.width/2, 320)
    const sw = 30
    const pad = 10
    const totalW = engine.state.slots.length * sw + (engine.state.slots.length - 1) * pad
    let sx = (ARENA.width - totalW) / 2
    for (let i = 0; i < engine.state.slots.length; i++) {
       ctx.fillStyle = '#fffdf9'
       ctx.fillRect(sx, 340, sw, sw)
       ctx.strokeStyle = '#e6e0d6'
       ctx.strokeRect(sx, 340, sw, sw)
       const p = engine.state.slots[i]
       if (p && p.length > 0) {
          ctx.fillStyle = '#1f6fd1'
          ctx.font = '10px Inter'
          ctx.fillText(p[0]?.toUpperCase() ?? '', sx + sw/2, 340 + sw/2 + 3)
       }
       sx += sw + pad
    }
    
    ctx.fillStyle = '#f6821f'
    ctx.fillRect(ARENA.width/2 - 50, ARENA.height - 80, 100, 40)
    ctx.fillStyle = '#fffdf9'
    ctx.font = 'bold 16px Inter'
    ctx.fillText('Ready', ARENA.width/2, ARENA.height - 55)

  } else if (engine.state.phase === 'playing' || engine.state.phase === 'over') {
    // Center line
    ctx.strokeStyle = '#e6e0d6'
    ctx.setLineDash([5, 5])
    ctx.beginPath()
    ctx.moveTo(0, ARENA.height/2)
    ctx.lineTo(ARENA.width, ARENA.height/2)
    ctx.stroke()
    ctx.setLineDash([])
    
    // Candy
    for (const c of engine.state.candy) {
       if (c.active) {
          ctx.fillStyle = '#1f9d5b'
          ctx.beginPath()
          ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2)
          ctx.fill()
       }
    }
    
    // Player
    const plW = engine.state.player.w * (engine.state.player.activePowerups.some(p => p.type === 'extension') ? 1.5 : 1)
    ctx.fillStyle = '#1f6fd1'
    ctx.fillRect(engine.state.player.x - plW/2, engine.state.player.y - engine.state.player.h/2, plW, engine.state.player.h)
    
    // Glass wall
    if (engine.state.playerGlassWallActive) {
       ctx.fillStyle = 'rgba(31, 111, 209, 0.4)'
       ctx.fillRect(0, engine.state.player.y + 10, ARENA.width, 10)
    }

    // AI
    const aiW = engine.state.ai.w * (engine.state.ai.activePowerups.some(p => p.type === 'extension') ? 1.5 : 1)
    ctx.fillStyle = '#f6821f'
    ctx.fillRect(engine.state.ai.x - aiW/2, engine.state.ai.y - engine.state.ai.h/2, aiW, engine.state.ai.h)
    
    // Ball
    ctx.fillStyle = '#d8433d'
    ctx.beginPath()
    ctx.arc(engine.state.ball.x, engine.state.ball.y, engine.state.ball.radius, 0, Math.PI * 2)
    ctx.fill()
    
    // Notifications
    ctx.font = 'bold 12px Inter'
    ctx.textAlign = 'center'
    for (const notif of engine.state.notifications) {
       ctx.fillStyle = `rgba(35, 35, 36, ${Math.min(1, notif.time)})`
       ctx.fillText(notif.text, ARENA.width/2, notif.y)
    }
  }
}
