import { useEffect, useRef, useState } from 'react'
import type { CardJitsuSession } from '../engine/gateway/session'
import './ruffle-stage.css'

interface RuffleStageProps {
  readonly session: CardJitsuSession
}

interface RufflePlayerInstance {
  readonly newest: () => {
    readonly createPlayer: () => HTMLElement & {
      readonly load: (options: { url: string; allowScriptAccess?: boolean }) => Promise<void>
      readonly dispatchAirtowerMessage?: (action: string, resObj: unknown) => void
      readonly remove: () => void
    }
  }
  config?: Record<string, unknown> | undefined
}

declare global {
  interface Window {
    RufflePlayer?: RufflePlayerInstance | undefined
    onFlashAirtowerSend?: (
      ext: string,
      action: string,
      args: readonly unknown[],
      type: string,
      roomId: number,
    ) => void
    onFlashGameScore?: (score: number) => void
  }
}

export function RuffleStage({ session }: RuffleStageProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let playerElement: (HTMLElement & {
      readonly load: (options: { url: string; allowScriptAccess?: boolean }) => Promise<void>
      readonly dispatchAirtowerMessage?: (action: string, resObj: unknown) => void
      readonly remove: () => void
    }) | null = null

    const initRuffle = async () => {
      try {
        setLoading(true)
        setError(null)

        // Ensure Ruffle script is present
        if (!window.RufflePlayer) {
          const existingScript = document.querySelector('script[src*="ruffle.js"]')
          if (!existingScript) {
            await new Promise<void>((resolve, reject) => {
              const script = document.createElement('script')
              script.src = '/games/card-jitsu/ruffle/ruffle.js'
              script.async = true
              script.onload = () => resolve()
              script.onerror = () => reject(new Error('Failed to load Ruffle WASM engine'))
              document.head.appendChild(script)
            })
          } else {
            // Wait for existing script to load
            await new Promise<void>((resolve) => {
              const check = setInterval(() => {
                if (window.RufflePlayer) {
                  clearInterval(check)
                  resolve()
                }
              }, 50)
            })
          }
        }

        if (cancelled || !containerRef.current) return
        if (!window.RufflePlayer) {
          throw new Error('RufflePlayer was not initialized')
        }

        // Configure Ruffle runtime
        window.RufflePlayer.config = {
          publicPath: '/games/card-jitsu/ruffle/',
          polyfills: false,
          autoplay: 'on',
          unmuteOverlay: 'hidden',
          letterbox: 'on',
          warnOnUnsupportedContent: false,
          quality: 'high',
        }

        const ruffle = window.RufflePlayer.newest()
        const player = ruffle.createPlayer()
        playerElement = player

        // Connect global ExternalInterface hooks
        window.onFlashAirtowerSend = (ext, action, args, type, roomId) => {
          session.handleFlashPacket(ext, action, args, type, roomId)
        }

        window.onFlashGameScore = (_score) => {
          // Handled via session onGameOver
        }

        // Bridge outgoing TypeScript virtual SmartFox packets to Flash
        session.setBridge((action, resObj) => {
          if (player && typeof player.dispatchAirtowerMessage === 'function') {
            const payload = Array.isArray(resObj) ? [...resObj] : [resObj]
            // Support both direct indexing and CP dataObj property
            ;(payload as unknown as { dataObj: unknown }).dataObj = payload
            player.dispatchAirtowerMessage(action, payload)
          }
        })

        // Mount player into DOM
        containerRef.current.innerHTML = ''
        containerRef.current.appendChild(player)

        // Load Disney Card-Jitsu bootstrap
        await player.load({
          url: '/games/card-jitsu/card_bootstrap.swf',
          allowScriptAccess: true,
        })

        if (!cancelled) {
          setLoading(false)
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[Card-Jitsu Ruffle Error]', err)
          setError(err instanceof Error ? err.message : 'Unknown Flash emulator error')
          setLoading(false)
        }
      }
    }

    void initRuffle()

    return () => {
      cancelled = true
      session.setBridge(() => {})
      if (window.onFlashAirtowerSend) {
        window.onFlashAirtowerSend = () => {}
      }
      if (playerElement) {
        try {
          playerElement.remove()
        } catch {
          // Ignore DOM removal errors
        }
      }
    }
  }, [session])

  return (
    <div className="nx-card-jitsu-stage-container">
      <div className="nx-card-jitsu-ruffle-stage" ref={containerRef}>
        {loading && (
          <div className="nx-card-jitsu-loading-overlay">
            <div className="nx-card-jitsu-spinner" />
            <div className="nx-card-jitsu-loading-text">
              Entering Dojo &bull; Initializing Card-Jitsu
            </div>
            <div className="nx-card-jitsu-loading-sub">
              Executing authentic Disney Flash engine via WebAssembly...
            </div>
          </div>
        )}

        {error && (
          <div className="nx-card-jitsu-loading-overlay">
            <div style={{ fontSize: '32px' }}>⚠️</div>
            <div className="nx-card-jitsu-loading-text">Failed to launch Card-Jitsu</div>
            <div className="nx-card-jitsu-loading-sub">{error}</div>
            <button
              type="button"
              className="nx-btn nx-btn-accent"
              style={{ marginTop: '12px', padding: '8px 20px' }}
              onClick={() => window.location.reload()}
            >
              Reload Dojo
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
