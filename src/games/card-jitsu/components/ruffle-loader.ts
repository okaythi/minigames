export interface RuffleLoadOptions {
  readonly url: string
  readonly allowScriptAccess?: boolean
  readonly publicPath?: string
  readonly polyfills?: boolean
  readonly autoplay?: 'on' | 'off' | 'auto'
  readonly unmuteOverlay?: 'visible' | 'hidden'
  readonly letterbox?: 'on' | 'off' | 'fullscreen'
  readonly scale?: 'showAll' | 'noborder' | 'exactFit' | 'noScale'
  readonly forceScale?: boolean
  readonly salign?: string
  readonly forceAlign?: boolean
  readonly quality?: 'low' | 'medium' | 'high' | 'best' | 'autolow' | 'autohigh'
  readonly logLevel?: 'error' | 'warn' | 'info' | 'debug' | 'trace'
  readonly parameters?: Record<string, string | number | boolean>
}

export type RufflePlayerElement = HTMLElement & {
  readonly load: (options: RuffleLoadOptions) => Promise<void>
  readonly dispatchAirtowerMessage?: (action: string, resObj: unknown) => void
  readonly pause?: () => void
  readonly remove: () => void
}

export interface RufflePlayerInstance {
  readonly newest: () => {
    readonly createPlayer: () => RufflePlayerElement
  }
  config?: Record<string, unknown>
}

declare global {
  interface Window {
    RufflePlayer?: RufflePlayerInstance
    onFlashAirtowerSend?: (
      ext: string,
      action: string,
      args: readonly unknown[],
      type: string,
      roomId: number,
    ) => void
    onFlashGameScore?: (score: number) => void
    onFlashPrompt?: (...args: readonly unknown[]) => void
    onFlashExit?: (roomId?: number) => void
    onMenuSelect?: (mode: string) => void
    onIntroComplete?: () => void
    stopMusic?: () => void
    shimLog?: (...args: unknown[]) => void
  }
}

const RUFFLE_SCRIPT_SRC = '/games/card-jitsu/ruffle/ruffle.js'
const RUFFLE_SCRIPT_TIMEOUT_MS = 20_000

/** Resolves once `window.RufflePlayer` is available, loading the engine script if needed. */
export async function ensureRuffleLoaded(isCancelled: () => boolean): Promise<void> {
  if (window.RufflePlayer) return

  const existingScript = document.querySelector<HTMLScriptElement>(
    `script[src="${RUFFLE_SCRIPT_SRC}"]`,
  )

  if (existingScript === null) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script')
      script.src = RUFFLE_SCRIPT_SRC
      script.async = true
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Failed to load Ruffle WASM engine'))
      document.head.appendChild(script)
    })
  }

  if (window.RufflePlayer) return

  await new Promise<void>((resolve, reject) => {
    const startedAt = Date.now()
    const check = window.setInterval(() => {
      if (window.RufflePlayer) {
        window.clearInterval(check)
        resolve()
        return
      }
      if (isCancelled()) {
        window.clearInterval(check)
        resolve()
        return
      }
      if (Date.now() - startedAt > RUFFLE_SCRIPT_TIMEOUT_MS) {
        window.clearInterval(check)
        reject(new Error('Timed out waiting for the Ruffle WASM engine'))
      }
    }, 50)
  })
}
