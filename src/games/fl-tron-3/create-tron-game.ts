import { DisposableBag } from '../../lib/disposable'
import { ARENA } from './engine/config'
import type { TronEngine } from './engine/engine'
import type { GameHost } from '../runtime/types'
import { fontsFor } from './render/types'
import { drawFrame } from './render/renderer'
import { computeArenaTransform } from './render/layout'

export function attachTronGame(host: GameHost, engine: TronEngine): DisposableBag {
  const bag = new DisposableBag()
  const { canvas, context, onFrame } = host
  const fonts = fontsFor(canvas)

  bag.add(
    onFrame((dt) => {
      engine.update(dt)
      drawFrame({
        context,
        engine,
        viewport: host.viewport(),
        time: performance.now() / 1000,
        fonts,
      })
    }),
  )

  bag.add(
    host.onResize(() => {
      drawFrame({
        context,
        engine,
        viewport: host.viewport(),
        time: performance.now() / 1000,
        fonts,
      })
    }),
  )

  bag.add(
    host.onVisibility((visible) => {
      if (!visible && engine.state.phase === 'playing') {
        engine.pause()
      }
    }),
  )

  const pointerPositionInArena = (clientX: number, clientY: number) => {
    const rect = canvas.getBoundingClientRect()
    const viewport = host.viewport()
    const transform = computeArenaTransform(viewport)

    // Canvas CSS pixel position
    const cssX = clientX - rect.left
    const cssY = clientY - rect.top

    // Map through scale and offset to arena coordinates
    const arenaX = (cssX - transform.offsetX) / transform.scale
    const arenaY = (cssY - transform.offsetY) / transform.scale

    return { x: arenaX, y: arenaY }
  }

  const handlePointerAction = (clientX: number, clientY: number) => {
    if (!engine.isStarted) {
      engine.startCampaign()
      return
    }

    const { x, y } = pointerPositionInArena(clientX, clientY)

    if (engine.state.phase === 'menu') {
      // Check if clicking inside Campaign button or start region
      if (x >= 40 && x <= ARENA.width - 40 && y >= 100 && y <= ARENA.height - 40) {
        engine.startCampaign()
      }
      return
    }

    if (engine.state.phase === 'intermission') {
      if (x >= 40 && x <= ARENA.width - 40 && y >= ARENA.height - 120 && y <= ARENA.height - 40) {
        engine.advanceFromIntermission()
      }
      return
    }

    if (engine.state.phase === 'victory' || engine.state.phase === 'game_over') {
      if (x >= 40 && x <= ARENA.width - 40 && y >= ARENA.height - 120 && y <= ARENA.height - 40) {
        engine.restart()
      }
      return
    }
  }

  const onMouseDown = (e: MouseEvent) => {
    handlePointerAction(e.clientX, e.clientY)
  }

  const onTouchStart = (e: TouchEvent) => {
    const touch = e.touches[0]
    if (!touch) return
    if (e.cancelable) e.preventDefault()
    handlePointerAction(touch.clientX, touch.clientY)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    // Prevent default scrolling for arrows and space
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
      e.preventDefault()
    }
    engine.handleInput(e.key, true)
  }

  canvas.addEventListener('mousedown', onMouseDown)
  bag.add(() => canvas.removeEventListener('mousedown', onMouseDown))

  canvas.addEventListener('touchstart', onTouchStart, { passive: false })
  bag.add(() => canvas.removeEventListener('touchstart', onTouchStart))

  window.addEventListener('keydown', onKeyDown)
  bag.add(() => window.removeEventListener('keydown', onKeyDown))

  return bag
}
