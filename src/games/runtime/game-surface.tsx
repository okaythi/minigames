import { useEffect, useRef } from 'react'
import { asDisposable, type Disposable } from '../../lib/disposable'
import type {
  FrameListener,
  GameHost,
  GameViewport,
  ResizeListener,
  VisibilityListener,
  GameViewFactory,
} from './types'
import './game-surface.css'

interface GameSurfaceProps {
  readonly attach: GameViewFactory
  /** width / height, used to reserve layout space before the first frame. */
  readonly aspect: number
  readonly label: string
  readonly className?: string | undefined
}

interface ListenerSet<TListener> {
  readonly add: (listener: TListener) => Disposable
  readonly emit: (notify: (listener: TListener) => void) => void
  readonly clear: () => void
}

function createListenerSet<TListener>(): ListenerSet<TListener> {
  const listeners = new Set<TListener>()
  return {
    add: (listener) => {
      listeners.add(listener)
      return asDisposable(() => {
        listeners.delete(listener)
      })
    },
    emit: (notify) => {
      for (const listener of [...listeners]) {
        notify(listener)
      }
    },
    clear: () => {
      listeners.clear()
    },
  }
}

/** Longest delta we feed the simulation; anything beyond that is a tab stall. */
const MAX_DELTA_SECONDS = 1 / 15

/**
 * Owns the `<canvas>`, the DPR-aware backing store, the resize observer and the
 * rAF loop. One place to reason about "is the game actually running".
 */
export function GameSurface({ attach, aspect, label, className }: GameSurfaceProps) {
  const boxRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Latest factory without re-running the mount effect.
  const attachRef = useRef<GameViewFactory>(attach)
  attachRef.current = attach

  useEffect(() => {
    const box = boxRef.current
    const canvas = canvasRef.current
    if (box === null || canvas === null) {
      return
    }
    const context = canvas.getContext('2d', { alpha: true })
    if (context === null) {
      return
    }

    const frameListeners = createListenerSet<FrameListener>()
    const resizeListeners = createListenerSet<ResizeListener>()
    const visibilityListeners = createListenerSet<VisibilityListener>()

    let viewport: GameViewport = {
      width: canvas.clientWidth,
      height: canvas.clientHeight,
      dpr: 1,
    }
    let running = true
    let frameHandle = 0
    let previous = performance.now()
    let elapsed = 0

    const applySize = (): void => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5)
      const width = Math.max(1, Math.round(canvas.clientWidth))
      const height = Math.max(1, Math.round(canvas.clientHeight))
      if (width === viewport.width && height === viewport.height && dpr === viewport.dpr) {
        return
      }
      viewport = { width, height, dpr }
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      resizeListeners.emit((listener) => {
        listener(viewport)
      })
    }

    applySize()

    const host: GameHost = {
      canvas,
      context,
      viewport: () => viewport,
      onFrame: (listener) => frameListeners.add(listener),
      onResize: (listener) => {
        const disposable = resizeListeners.add(listener)
        listener(viewport)
        return disposable
      },
      onVisibility: (listener) => visibilityListeners.add(listener),
    }

    const view: Disposable = attachRef.current(host)

    const observer = new ResizeObserver(applySize)
    observer.observe(canvas)

    const tick = (now: number): void => {
      frameHandle = requestAnimationFrame(tick)
      const raw = (now - previous) / 1000
      previous = now
      if (document.hidden || !running) {
        return
      }
      const delta = Math.min(Math.max(raw, 0), MAX_DELTA_SECONDS)
      elapsed += delta
      frameListeners.emit((listener) => {
        listener(delta, elapsed)
      })
    }
    frameHandle = requestAnimationFrame(tick)

    const handleVisibility = (): void => {
      visibilityListeners.emit((listener) => {
        listener(!document.hidden)
      })
      previous = performance.now()
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      cancelAnimationFrame(frameHandle)
      document.removeEventListener('visibilitychange', handleVisibility)
      observer.disconnect()
      view.dispose()
      frameListeners.clear()
      resizeListeners.clear()
      visibilityListeners.clear()
    }
  }, [])

  const classes = ['nx-surface', className].filter((part): part is string => part !== undefined)

  return (
    <div className={classes.join(' ')} ref={boxRef}>
      <canvas
        ref={canvasRef}
        className="nx-surface-canvas"
        tabIndex={0}
        role="img"
        aria-label={label}
        style={{ aspectRatio: String(aspect) }}
      />
    </div>
  )
}
