import type { GameHost } from '../../runtime/types'
import type { PongEngine } from '../engine/engine'

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
  
  const onPointerDown = () => {
    // handle loadout clicks or paddle movement
  }
  
  canvas.addEventListener('pointerdown', onPointerDown)

  return {
    dispose: () => {
      frameSub.dispose()
      canvas.removeEventListener('pointerdown', onPointerDown)
    }
  }
}

function draw(ctx: CanvasRenderingContext2D, engine: PongEngine) {
  ctx.fillStyle = '#faf7f2'
  ctx.fillRect(0, 0, 360, 480)
  
  if (engine.state.phase === 'loadout') {
    ctx.fillStyle = '#232324'
    ctx.font = '20px Inter'
    ctx.fillText('Loadout Phase', 20, 40)
  } else if (engine.state.phase === 'playing') {
    // draw player
    ctx.fillStyle = '#1f6fd1'
    ctx.fillRect(engine.state.player.x - engine.state.player.w/2, engine.state.player.y - engine.state.player.h/2, engine.state.player.w, engine.state.player.h)
    
    // draw AI
    ctx.fillStyle = '#f6821f'
    ctx.fillRect(engine.state.ai.x - engine.state.ai.w/2, engine.state.ai.y - engine.state.ai.h/2, engine.state.ai.w, engine.state.ai.h)
    
    // draw ball
    ctx.fillStyle = '#d8433d'
    ctx.beginPath()
    ctx.arc(engine.state.ball.x, engine.state.ball.y, engine.state.ball.radius, 0, Math.PI * 2)
    ctx.fill()
  }
}
