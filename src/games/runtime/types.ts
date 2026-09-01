import type { Disposable } from '../../lib/disposable'

/**
 * The contract between React and a game. A game receives a `GameHost`,
 * subscribes to what it cares about and returns a disposable. React never
 * touches game internals; games never touch React.
 */

export interface GameViewport {
  /** CSS pixel size of the canvas box. */
  readonly width: number
  readonly height: number
  /** Device pixel ratio the backing store was built for. */
  readonly dpr: number
}

export type FrameListener = (deltaSeconds: number, elapsedSeconds: number) => void
export type ResizeListener = (viewport: GameViewport) => void
export type VisibilityListener = (visible: boolean) => void

export interface GameHost {
  readonly canvas: HTMLCanvasElement
  readonly context: CanvasRenderingContext2D
  /** Fresh on every read, so a game never caches a stale size. */
  viewport(): GameViewport
  readonly onFrame: (listener: FrameListener) => Disposable
  readonly onResize: (listener: ResizeListener) => Disposable
  readonly onVisibility: (listener: VisibilityListener) => Disposable
}

export type GameViewFactory = (host: GameHost) => Disposable
