import { DisposableBag } from '../../lib/disposable'
import { drawFrame } from './render/renderer'
import type { AvoidSession } from './engine/session'
import type { GameHost } from '../runtime/types'

/**
 * Wiring between the simulation and the canvas host: input in, frames out.
 * Everything the game listens to is registered here and torn down as one bag,
 * so React StrictMode's double mount cannot leak a second loop.
 */

const FLAP_KEYS = new Set(['Space', 'ArrowUp', 'KeyW'])
const PAUSE_KEYS = new Set(['KeyP', 'Escape'])
const RESTART_KEYS = new Set(['Enter', 'KeyR'])

export function attachAvoidGame(host: GameHost, session: AvoidSession): DisposableBag {
  const bag = new DisposableBag()
  let time = 0

  bag.add(
    host.onFrame((delta) => {
      time += delta
      session.update(delta)
      drawFrame({ context: host.context, session, viewport: host.viewport(), time })
    }),
  )

  bag.add(
    host.onResize(() => {
      // The renderer re-reads the viewport every frame; this only forces an
      // immediate repaint so a resize never shows a stretched backbuffer.
      drawFrame({ context: host.context, session, viewport: host.viewport(), time })
    }),
  )

  bag.add(
    host.onVisibility((visible) => {
      if (!visible) {
        session.autoPause()
      }
    }),
  )

  const { canvas } = host
  const onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 && event.pointerType === 'mouse') {
      return
    }
    event.preventDefault()
    canvas.focus()
    session.primary()
  }
  canvas.addEventListener('pointerdown', onPointerDown)
  bag.add(() => {
    canvas.removeEventListener('pointerdown', onPointerDown)
  })

  const onContextMenu = (event: MouseEvent): void => {
    event.preventDefault()
  }
  canvas.addEventListener('contextmenu', onContextMenu)
  bag.add(() => {
    canvas.removeEventListener('contextmenu', onContextMenu)
  })

  const onKeyDown = (event: KeyboardEvent): void => {
    const target = event.target as HTMLElement | null
    if (target !== null && /^(input|textarea|select)$/i.test(target.tagName)) {
      return
    }
    if (FLAP_KEYS.has(event.code)) {
      event.preventDefault()
      session.primary()
      return
    }
    if (PAUSE_KEYS.has(event.code)) {
      event.preventDefault()
      session.togglePause()
      return
    }
    if (RESTART_KEYS.has(event.code)) {
      event.preventDefault()
      if (session.status === 'over') {
        session.restart()
      } else {
        session.primary()
      }
    }
  }
  window.addEventListener('keydown', onKeyDown)
  bag.add(() => {
    window.removeEventListener('keydown', onKeyDown)
  })

  const onBlur = (): void => {
    session.autoPause()
  }
  window.addEventListener('blur', onBlur)
  bag.add(() => {
    window.removeEventListener('blur', onBlur)
  })

  // First frame, so a paused/hidden canvas is never blank.
  drawFrame({ context: host.context, session, viewport: host.viewport(), time })

  return bag
}
