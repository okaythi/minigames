import { useEffect, useRef, useState } from 'react'
import type { CardJitsuSession } from '../engine/gateway/session'
import {
  ensureRuffleLoaded,
  type RuffleLoadOptions,
  type RufflePlayerElement,
} from './ruffle-loader'
import './ruffle-stage.css'

interface RuffleStageProps {
  readonly session: CardJitsuSession
  readonly inMatch: boolean
  readonly onStartMatch: (mode: 'belts' | 'sensei') => void
  readonly onInstructions: () => void
  readonly onExit?: () => void
}

const BUILD_ID = '20260905_v2'

export function RuffleStage({
  session,
  inMatch,
  onStartMatch,
  onInstructions,
  onExit,
}: RuffleStageProps) {
  /**
   * Dedicated mount node for the <ruffle-player> element.
   * Ruffle is mounted imperatively; overlays and audio are siblings.
   */
  const hostRef = useRef<HTMLDivElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const playerRef = useRef<RufflePlayerElement | null>(null)

  const onExitRef = useRef(onExit)
  onExitRef.current = onExit
  const onStartMatchRef = useRef(onStartMatch)
  onStartMatchRef.current = onStartMatch
  const onInstructionsRef = useRef(onInstructions)
  onInstructionsRef.current = onInstructions
  const inMatchRef = useRef(inMatch)
  inMatchRef.current = inMatch

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

  const loadMovie = async (player: RufflePlayerElement, isMatch: boolean) => {
    setLoading(true)
    setError(null)
    try {
      const options: RuffleLoadOptions = isMatch
        ? {
            url: `/games/card-jitsu/card_bootstrap.swf?v=${BUILD_ID}`,
            allowScriptAccess: true,
            publicPath: '/games/card-jitsu/ruffle/',
            polyfills: false,
            autoplay: 'on',
            unmuteOverlay: 'hidden',
            letterbox: 'on',
            scale: 'showAll',
            forceScale: true,
            salign: '',
            forceAlign: true,
            quality: 'high',
            logLevel: 'info',
            parameters: {
              nick: session.getPlayerNick(),
              mode: session.isSenseiMode() ? 'MODE_SEN' : 'MODE_EXP',
              color: session.getPlayerColor(),
              rank: session.getPlayerBeltRank(),
            },
          }
        : {
            url: `/games/card-jitsu/card_menu.swf?v=${BUILD_ID}`,
            allowScriptAccess: true,
            publicPath: '/games/card-jitsu/ruffle/',
            polyfills: false,
            autoplay: 'on',
            unmuteOverlay: 'hidden',
            letterbox: 'on',
            scale: 'showAll',
            forceScale: true,
            salign: '',
            forceAlign: true,
            quality: 'high',
            logLevel: 'info',
          }

      await player.load(options)
    } catch (err) {
      console.error('[Card-Jitsu Ruffle Load Error]', err)
      setError(err instanceof Error ? err.message : 'Unknown Flash emulator error')
    } finally {
      setLoading(false)
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
        playerRef.current = player

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

        session.setBridge((msg: string) => {
          if (cancelled || !player.isConnected) return
          pending.push(msg)
          schedule()
        })

        window.onMenuSelect = (mode: string) => {
          console.log('[flash→ts onMenuSelect]', mode)
          handleUserInteraction()
          if (mode === 'belts') {
            onStartMatchRef.current('belts')
          } else if (mode === 'sensei') {
            onStartMatchRef.current('sensei')
          } else if (mode === 'instructions') {
            onInstructionsRef.current()
          }
        }

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

        host.replaceChildren(player)

        await loadMovie(player, inMatchRef.current)
        if (cancelled) return
        schedule()
      } catch (err) {
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
      window.onMenuSelect = () => {}
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
      playerRef.current = null
      if (player !== null) {
        try {
          player.remove()
        } catch {
          // Ignore DOM removal errors
        }
      }
      hostRef.current?.replaceChildren()
    }
  }, [session])

  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    const player = playerRef.current
    if (player && player.isConnected) {
      void loadMovie(player, inMatch)
    }
  }, [inMatch])

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
              {inMatch ? 'Entering Dojo • Initializing Card-Jitsu' : 'Visiting Sensei • Entering Dojo'}
            </div>
            <div className="nx-card-jitsu-loading-sub">
              Executing authentic Disney Flash engine via WebAssembly...
            </div>
          </div>
        )}

        {error !== null && (
          <div className="nx-card-jitsu-loading-overlay">
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
              <div className="nx-card-jitsu-prompt-title">Card-Jitsu</div>
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
