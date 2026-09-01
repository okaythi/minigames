import { DisposableBag } from '../../lib/disposable'
import { ARENA, COSTS } from './engine/config'
import type { PongEngine } from './engine/engine'
import type { GameHost } from '../runtime/types'
import { drawFrame, fontsFor, createFx, captureFx, advanceFx, type PongFx } from './render/render'
import { SHOP_ITEMS } from './render/draw-menus'
import { itemYFor } from './render/draw-powerups'

export function attachPongGame(host: GameHost, engine: PongEngine): DisposableBag {
  const bag = new DisposableBag()
  const { canvas, context, onFrame } = host
  const fonts = fontsFor(canvas)
  const fx: PongFx = createFx()

  bag.add(
    onFrame((dt) => {
      engine.update(dt)
      captureFx(engine, fx)
      advanceFx(fx, dt)
      drawFrame({ context, engine, viewport: host.viewport(), time: performance.now() / 1000, fonts, fx })
    }),
  )

  bag.add(
    host.onResize(() => {
      drawFrame({ context, engine, viewport: host.viewport(), time: performance.now() / 1000, fonts, fx })
    }),
  )

  bag.add(
    host.onVisibility((visible) => {
      if (!visible && engine.state.phase === 'playing') {
        engine.pause()
      }
    }),
  )

  const pointerPosition = (clientX: number, clientY: number) => {
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((clientX - rect.left) / rect.width) * ARENA.width,
      y: ((clientY - rect.top) / rect.height) * ARENA.height,
    }
  }

  const handlePointerAction = (x: number, y: number) => {
    engine.pointerDown = true
    engine.pointerX = x

    if (engine.state.phase === 'playing' && engine.state.ball.stuckToPlayer) {
      engine.releaseMagnetBall()
      return
    }

    if (engine.state.phase === 'config') {
      if (y >= 100 && y <= 140) {
        if (x >= 40 && x <= 120) engine.state.mode = 11
        else if (x >= 140 && x <= 220) engine.state.mode = 21
        else if (x >= 240 && x <= 320) engine.state.mode = 30
      }

      if (y >= 200 && y <= 240) {
        if (x >= 40 && x <= 100) engine.state.difficulty = 'easy'
        else if (x >= 120 && x <= 200) engine.state.difficulty = 'normal'
        else if (x >= 220 && x <= 280) engine.state.difficulty = 'hard'
      }
      if (y >= 250 && y <= 290) {
        if (x >= 40 && x <= 180 && engine.isVeryHardUnlocked()) {
          engine.state.difficulty = 'very-hard'
        }
      }

      if (
        x >= ARENA.width / 2 - 50 &&
        x <= ARENA.width / 2 + 50 &&
        y >= ARENA.height - 80 &&
        y <= ARENA.height - 40
      ) {
        engine.confirmConfig()
      }
      return
    }

    if (engine.state.phase === 'loadout') {
      if (
        x >= ARENA.width / 2 - 50 &&
        x <= ARENA.width / 2 + 50 &&
        y >= ARENA.height - 80 &&
        y <= ARENA.height - 40
      ) {
        engine.startMatch()
        return
      }

      for (const item of SHOP_ITEMS) {
        const itemY = itemYFor(item.type)
        if (x >= 40 && x <= ARENA.width - 40 && y >= itemY && y <= itemY + 40) {
          const emptyIdx = engine.state.slots.indexOf(null)
          if (emptyIdx !== -1 && engine.deps.current.bonus >= COSTS[item.type]) {
            engine.deps.current.bankBonus(-COSTS[item.type])
            engine.state.slots[emptyIdx] = item.type
          }
        }
      }
    }
  }

  const onMouseDown = (e: MouseEvent) => {
    const point = pointerPosition(e.clientX, e.clientY)
    handlePointerAction(point.x, point.y)
  }

  const onTouchStart = (e: TouchEvent) => {
    const touch = e.touches[0]
    if (!touch) return
    if (e.cancelable) e.preventDefault()
    const point = pointerPosition(touch.clientX, touch.clientY)
    handlePointerAction(point.x, point.y)
  }

  const onMouseMove = (e: MouseEvent) => {
    if (engine.pointerDown || engine.state.phase === 'playing') {
      engine.pointerX = pointerPosition(e.clientX, e.clientY).x
    }
  }

  const onTouchMove = (e: TouchEvent) => {
    const touch = e.touches[0]
    if (!touch) return
    if (engine.pointerDown || engine.state.phase === 'playing') {
      engine.pointerX = pointerPosition(touch.clientX, touch.clientY).x
      if (e.cancelable) e.preventDefault()
    }
  }

  const onPointerUp = () => {
    engine.pointerDown = false
  }

  const onKeyDown = (e: KeyboardEvent) => {
    engine.handleInput(e.key, true)
  }

  canvas.addEventListener('mousedown', onMouseDown)
  bag.add(() => canvas.removeEventListener('mousedown', onMouseDown))

  canvas.addEventListener('touchstart', onTouchStart, { passive: false })
  bag.add(() => canvas.removeEventListener('touchstart', onTouchStart))

  window.addEventListener('mousemove', onMouseMove)
  bag.add(() => window.removeEventListener('mousemove', onMouseMove))

  window.addEventListener('touchmove', onTouchMove, { passive: false })
  bag.add(() => window.removeEventListener('touchmove', onTouchMove))

  window.addEventListener('mouseup', onPointerUp)
  bag.add(() => window.removeEventListener('mouseup', onPointerUp))

  window.addEventListener('touchend', onPointerUp)
  bag.add(() => window.removeEventListener('touchend', onPointerUp))

  window.addEventListener('keydown', onKeyDown)
  bag.add(() => window.removeEventListener('keydown', onKeyDown))

  return bag
}
