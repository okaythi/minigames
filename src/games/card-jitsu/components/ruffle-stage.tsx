import { useEffect, useRef, useState } from 'react'
import type { CardJitsuSession } from '../engine/gateway/session'
import './ruffle-stage.css'

interface RuffleStageProps {
  readonly session: CardJitsuSession
  readonly onExit?: () => void
}

type RufflePlayerElement = HTMLElement & {
  readonly load: (options: Record<string, unknown>) => Promise<void>
  readonly dispatchAirtowerMessage?: (action: string, resObj: unknown) => void
  readonly remove: () => void
}

interface RufflePlayerInstance {
  readonly newest: () => {
    readonly createPlayer: () => RufflePlayerElement
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
    onFlashPrompt?: (...args: readonly unknown[]) => void
    onFlashExit?: (roomId?: number) => void
    stopMusic?: () => void
    shimLog?: (...args: unknown[]) => void
  }
}

const RUFFLE_SCRIPT_SRC = '/games/card-jitsu/ruffle/ruffle.js'
const RUFFLE_SCRIPT_TIMEOUT_MS = 20_000

/** Resolves once `window.RufflePlayer` is available, loading the engine script if needed. */
async function ensureRuffleLoaded(isCancelled: () => boolean): Promise<void> {
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

  // The script tag may exist but not have finished evaluating yet.
  if (window.RufflePlayer) return

  await new Promise<void>((resolve, reject) => {
    const startedAt = Date.now()
    const check = window.setInterval(() => {
      if (window.RufflePlayer) {
        window.clearInterval(check)
        resolve()
        return
      }
      // Stop polling if the view unmounted or the engine never showed up.
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

export function RuffleStage({ session, onExit }: RuffleStageProps) {
  /**
   * Dedicated mount node for the <ruffle-player> element.
   *
   * IMPORTANT: React must never render children into this node. Ruffle is mounted
   * imperatively, so if React also owned children here, clearing/appending would
   * detach nodes React still tracks and the next commit would throw
   * "Failed to execute 'removeChild' on 'Node'". The loading/error overlays are
   * therefore rendered as *siblings* of this host, never inside it.
   */
  const hostRef = useRef<HTMLDivElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const onExitRef = useRef(onExit)
  onExitRef.current = onExit
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [promptData, setPromptData] = useState<{ message: string } | null>(null)

  const handleUserInteraction = () => {
    const audio = audioRef.current
    if (audio && audio.paused) {
      audio.play().catch(() => {
        // Ignored if browser requires stronger user gesture
      })
    }
  }

  useEffect(() => {
    let cancelled = false
    let playerElement: RufflePlayerElement | null = null

    const isCancelled = () => cancelled

    const initRuffle = async () => {
      try {
        setLoading(true)
        setError(null)

        await ensureRuffleLoaded(isCancelled)

        if (cancelled) return

        const host = hostRef.current
        if (host === null) return

        if (!window.RufflePlayer) {
          throw new Error('RufflePlayer was not initialized')
        }

        const ruffle = window.RufflePlayer.newest()
        const player = ruffle.createPlayer()
        playerElement = player

        // Fill the stage container. Ruffle's shadow root defaults the host to a
        // fixed 550x400 inline-block; sizing it here is reliable.
        player.setAttribute('width', '100%')
        player.setAttribute('height', '100%')

        window.shimLog = (...a) => console.log('[shim]', JSON.stringify(a))

        const pending: string[] = []
        let scheduled = false
        const flush = () => {
          scheduled = false
          if (typeof player.dispatchAirtowerMessage !== 'function') {
            schedule()
            return
          }
          while (pending.length) {
            const raw = pending.shift()!
            const parts = raw.split('%')
            if (parts.length < 4 || parts[1] !== 'xt') continue
            console.log('[ts→flash]', raw)
            try {
              player.dispatchAirtowerMessage(parts[2]!, parts.slice(3, -1))
            } catch (bridgeError) {
              console.warn('[Card-Jitsu Ruffle] dispatch error', parts[2], bridgeError)
            }
          }
        }
        const schedule = () => {
          if (!scheduled) {
            scheduled = true
            setTimeout(flush, 0)
          }
        }

        // Bridge outgoing TypeScript virtual SmartFox packets to Flash.
        session.setBridge((msg: string) => {
          if (cancelled || !player.isConnected) return
          pending.push(msg)
          schedule()
        })

        // Connect global ExternalInterface hooks
        window.onFlashAirtowerSend = (ext, action, args, type, roomId) => {
          console.log('[flash→ts]', ext, action, JSON.stringify(args), type, roomId)
          if (cancelled) return
          session.handleFlashPacket(ext, action, args, type, roomId)
        }

        window.onFlashGameScore = (_score) => {
          // Handled via session onGameOver
        }

        window.onFlashPrompt = (...args: readonly unknown[]) => {
          console.log('[flash→ts onFlashPrompt]', JSON.stringify(args))
          if (cancelled) return
          const flat = (args as unknown[]).flat(Infinity)
          const textCandidate = flat.find((x) => typeof x === 'string' && (x as string).length > 0) as
            | string
            | undefined
          setPromptData({ message: textCandidate ?? 'Match concluded.' })
        }

        window.onFlashExit = (roomId?: number) => {
          console.log('[flash→ts onFlashExit]', roomId)
          if (cancelled) return
          onExitRef.current?.()
        }

        window.stopMusic = () => {
          console.log('[Card-Jitsu Audio] stopMusic called from Flash')
          if (audioRef.current) {
            audioRef.current.pause()
          }
        }

        // Mount player into the React-free host node.
        host.replaceChildren(player)

        // Load Disney Card-Jitsu bootstrap with exact forceScale/forceAlign & logging
        const BUILD_ID = '20260905_v1'
        await player.load({
          url: `/games/card-jitsu/card_bootstrap.swf?v=${BUILD_ID}`,
          allowScriptAccess: true,
          publicPath: '/games/card-jitsu/ruffle/',
          polyfills: false,
          autoplay: 'on',
          unmuteOverlay: 'hidden',
          letterbox: 'on',
          scale: 'showAll',
          forceScale: true,   // ignore Stage.scaleMode from the SWF
          salign: '',         // center
          forceAlign: true,   // ignore Stage.align = "TL"
          quality: 'high',
          logLevel: 'info',
          parameters: {
            nick: session.getPlayerNick(),
            mode: session.getMode(),
            color: session.getPlayerColor(),
            rank: session.getPlayerBeltRank(),
          },
        })

        if (cancelled) return
        schedule()
        setLoading(false)
      } catch (err) {
        // Errors raised after unmount (e.g. a load() rejected because the
        // instance was torn down) must not touch state.
        if (cancelled) return
        console.error('[Card-Jitsu Ruffle Error]', err)
        setError(err instanceof Error ? err.message : 'Unknown Flash emulator error')
        setLoading(false)
      }
    }

    void initRuffle()

    return () => {
      cancelled = true
      session.setBridge(() => {})
      window.onFlashAirtowerSend = () => {}
      window.onFlashGameScore = () => {}
      window.onFlashPrompt = () => {}
      window.onFlashExit = () => {}
      window.stopMusic = () => {}
      if (audioRef.current) {
        audioRef.current.pause()
      }

      const player = playerElement
      playerElement = null
      if (player !== null) {
        try {
          // Element.remove() is a no-op when already detached; Ruffle destroys
          // the instance in its disconnectedCallback.
          player.remove()
        } catch {
          // Ignore DOM removal errors
        }
      }
      // Only clear the imperative host — never a React-managed node.
      hostRef.current?.replaceChildren()
    }
  }, [session])

  return (
    <div
      className="nx-card-jitsu-stage-container"
      onClick={handleUserInteraction}
      onKeyDown={handleUserInteraction}
      role="application"
      tabIndex={0}
    >
      <audio
        ref={audioRef}
        id="ninja-music"
        loop
        preload="auto"
        src="/games/card-jitsu/music/ninja-training.mp3"
      />
      <div className="nx-card-jitsu-ruffle-stage">
        {/* Imperatively managed by Ruffle — keep this element childless in JSX. */}
        <div className="nx-card-jitsu-ruffle-host" ref={hostRef} />

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

        {error !== null && (
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

        {promptData !== null && (
          <div className="nx-card-jitsu-modal-overlay">
            <div className="nx-card-jitsu-prompt-box">
              <div className="nx-card-jitsu-prompt-title">🥋 Card-Jitsu</div>
              <div className="nx-card-jitsu-prompt-message">{promptData.message}</div>
              <button
                type="button"
                className="nx-btn nx-btn-primary"
                style={{ marginTop: '12px', padding: '10px 24px', fontSize: '15px', fontWeight: 'bold' }}
                onClick={() => {
                  setPromptData(null)
                  onExitRef.current?.()
                }}
              >
                Return to Dojo
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
