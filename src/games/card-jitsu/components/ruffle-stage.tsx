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

interface PromptData {
  readonly title: string
  readonly message: string
  readonly buttonLabel: string
}

const PROMPT_TITLES: Record<string, string> = {
  win: 'Game Over',
  sudden_death: 'Sudden Death',
  player_quit_prompt: 'Player Quit',
  quit_game_prompt: 'Leave Game',
  game_over: 'Game Over',
}

const BELT_NAMES = [
  'Novice',
  'White Belt',
  'Yellow Belt',
  'Orange Belt',
  'Green Belt',
  'Blue Belt',
  'Red Belt',
  'Purple Belt',
  'Brown Belt',
  'Black Belt',
  'Ninja Master',
] as const

function outcomeLabel(winMethod: 'same-element' | 'three-elements' | 'no-cards' | 'forfeit'): string {
  switch (winMethod) {
    case 'same-element':
      return 'Three colours of one element'
    case 'three-elements':
      return 'Fire, Water & Snow triad'
    case 'no-cards':
      return 'No playable cards remained'
    case 'forfeit':
      return 'Match forfeited'
  }
}

function beltName(rank: number | undefined): string | null {
  if (rank === undefined) return null
  return BELT_NAMES[Math.max(0, Math.min(BELT_NAMES.length - 1, rank))] ?? null
}

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
  const [promptData, setPromptData] = useState<PromptData | null>(null)
  const [matchEndOpen, setMatchEndOpen] = useState(false)
  // Progress receipts arrive asynchronously after the Flash game-over packet.
  // This small revision state keeps the composed result panel in sync with the
  // session without duplicating authoritative match state in React.
  const [, setSessionRevision] = useState(0)

  const returnToDojo = async () => {

    // 1. await onMatchEnd
    try {
      await session.waitForMatchEnd()
    } catch (err) {
      console.warn('[Card-Jitsu] Error waiting for match end:', err)
    }

    // 2. unload card.swf
    const player = playerRef.current
    if (player && player.isConnected) {
      try {
        player.pause?.()
      } catch {}
    }

    // 3. stop music
    window.stopMusic?.()

    // 4. menu
    onExitRef.current?.()
  }

  const handlePromptOk = async () => {
    setPromptData(null)
    await returnToDojo()
  }

  const handleMatchEndContinue = async () => {
    setMatchEndOpen(false)
    await returnToDojo()
  }

  useEffect(() => session.subscribe((stats, phase) => {
    setSessionRevision((revision) => revision + 1)
    if (phase === 'game-over' && stats.matchWinner !== null) {
      setPromptData(null)
      setMatchEndOpen(true)
    }
  }), [session])

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
            parameters: {
              nick: session.getPlayerNick(),
              introSeen: (session.getIntroSeen() || session.hasItemInInventory(821)) ? '1' : '0',
              hasCards: (session.getIntroSeen() || session.hasItemInInventory(821)) ? '1' : '0',
              rank: String(session.getPlayerBeltRank()),
              color: String(session.getPlayerColor()),
            },
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
          if (mode === 'belts') {
            onStartMatchRef.current('belts')
          } else if (mode === 'sensei') {
            onStartMatchRef.current('sensei')
          } else if (mode === 'instructions') {
            onInstructionsRef.current()
          }
        }

        window.onIntroComplete = () => {
          console.log('[flash→ts onIntroComplete]')
          if (cancelled) return
          void session.completeIntro()
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
          // The authentic SWF opens a generic `{player} won/lost` prompt as
          // soon as it receives czo. Replace only completed-match prompts
          // with the richer, server-receipt-backed result panel below.
          if (session.getMatchResult() !== null || session.getPhase() === 'game-over') {
            setPromptData(null)
            setMatchEndOpen(true)
            return
          }
          const flat = (args as unknown[]).flat(Infinity)
          const strings = flat.filter((x): x is string => typeof x === 'string' && x.length > 0)
          const rawMessage = strings[0] ?? 'Match concluded.'
          const rawButton = strings.find((s) => s.toLowerCase() === 'ok') ?? strings[1] ?? 'OK'

          let title = 'Game Over'
          for (const [key, titleText] of Object.entries(PROMPT_TITLES)) {
            if (
              strings.some((s) => s.toLowerCase().includes(key)) ||
              rawMessage.toLowerCase().includes(key)
            ) {
              title = titleText
              break
            }
          }

          setPromptData({
            title,
            message: rawMessage,
            buttonLabel: rawButton.toUpperCase() === 'OK' ? 'OK' : rawButton,
          })
        }

        window.onFlashExit = (roomId?: number) => {
          console.log('[flash→ts onFlashExit]', roomId)
          if (cancelled) return
          setPromptData(null)
          setMatchEndOpen(false)
          onExitRef.current?.()
        }

        window.stopMusic = () => {
          console.log('[Card-Jitsu Audio] stopMusic called from Flash')
        }

        host.replaceChildren(player)

        // Await server-authoritative profile before loading movie FlashVars
        try {
          await Promise.race([
            session.waitForReady(),
            new Promise((resolve) => setTimeout(resolve, 2000)),
          ])
        } catch {}
        if (cancelled) return

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
      window.onIntroComplete = () => {}
      window.onFlashAirtowerSend = () => {}
      window.onFlashGameScore = () => {}
      window.onFlashPrompt = () => {}
      window.onFlashExit = () => {}
      window.stopMusic = () => {}

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

  const matchResult = session.getMatchResult()
  const progression = session.getMatchProgression()
  const playerWon = matchResult?.winner === 'player'
  const currentBeltName = beltName(progression?.rank)

  return (
    <div
      className="nx-card-jitsu-stage-container"
      role="application"
      tabIndex={0}
    >
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

        {matchEndOpen && matchResult !== null && (
          <div className="nx-card-jitsu-results-overlay" role="dialog" aria-modal="true" aria-labelledby="card-jitsu-result-title">
            <section className={`nx-card-jitsu-results-card ${playerWon ? 'is-victory' : 'is-defeat'}`}>
              <div className="nx-card-jitsu-results-knot" aria-hidden="true">◆</div>
              <div className="nx-card-jitsu-results-heading">
                <p className="nx-card-jitsu-results-eyebrow">{matchResult.mode === 'sensei' ? 'Sensei Challenge' : 'Dojo Match Complete'}</p>
                <h2 id="card-jitsu-result-title">
                  {playerWon ? 'Victory in the Dojo' : 'A Lesson from the Dojo'}
                </h2>
                <p className="nx-card-jitsu-results-summary">
                  <strong>{playerWon ? session.getPlayerNick() : session.getOpponentNick()}</strong>
                  {playerWon ? ' claimed the match.' : ' claimed the match.'}
                </p>
              </div>

              <div className="nx-card-jitsu-results-score" aria-label="Match score">
                <div>
                  <span>{session.getPlayerNick()}</span>
                  <strong>{matchResult.playerBank.length}</strong>
                  <small>cards won</small>
                </div>
                <span className="nx-card-jitsu-results-versus">VS</span>
                <div>
                  <span>{session.getOpponentNick()}</span>
                  <strong>{matchResult.opponentBank.length}</strong>
                  <small>cards won</small>
                </div>
              </div>

              <dl className="nx-card-jitsu-results-details">
                <div>
                  <dt>Match finish</dt>
                  <dd>{outcomeLabel(matchResult.winMethod)}</dd>
                </div>
                <div>
                  <dt>Rounds played</dt>
                  <dd>{matchResult.rounds}</dd>
                </div>
                {matchResult.flawless && playerWon && (
                  <div>
                    <dt>Dojo honour</dt>
                    <dd>Flawless victory</dd>
                  </div>
                )}
              </dl>

              <div className={`nx-card-jitsu-progress-receipt is-${progression?.status ?? 'saving'}`}>
                {progression?.status === 'saved' ? (
                  <>
                    <span className="nx-card-jitsu-progress-mark" aria-hidden="true">✓</span>
                    <div>
                      <p>Ninja progress saved</p>
                      <strong>
                        {progression.awardRank !== undefined
                          ? `${beltName(progression.awardRank) ?? 'New belt'} earned!`
                          : progression.progressAwarded && progression.progressAwarded > 0
                            ? `+${progression.progressAwarded} Ninja XP`
                            : 'Ninja record updated'}
                      </strong>
                      {currentBeltName !== null && progression.progress !== undefined && (
                        <small>{currentBeltName} · {progression.progress} total XP</small>
                      )}
                    </div>
                  </>
                ) : progression?.status === 'not-saved' ? (
                  <>
                    <span className="nx-card-jitsu-progress-mark" aria-hidden="true">!</span>
                    <div>
                      <p>Progress not saved</p>
                      <strong>{progression.message ?? 'This match could not be recorded.'}</strong>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="nx-card-jitsu-progress-spinner" aria-hidden="true" />
                    <div>
                      <p>Recording your match</p>
                      <strong>Saving Ninja progress…</strong>
                    </div>
                  </>
                )}
              </div>

              <button
                type="button"
                className="nx-card-jitsu-results-continue"
                onClick={() => {
                  void handleMatchEndContinue()
                }}
              >
                Return to Dojo
              </button>
            </section>
          </div>
        )}

        {promptData !== null && !matchEndOpen && (
          <div className="nx-card-jitsu-modal-overlay" role="dialog" aria-modal="true">
            <div className="nx-card-jitsu-modal-card">
              <h2 className="nx-card-jitsu-modal-title">{promptData.title}</h2>
              <p className="nx-card-jitsu-modal-body">{promptData.message}</p>
              <div className="nx-card-jitsu-modal-actions">
                <button
                  type="button"
                  className="nx-btn nx-btn-primary"
                  onClick={() => {
                    void handlePromptOk()
                  }}
                >
                  {promptData.buttonLabel}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
