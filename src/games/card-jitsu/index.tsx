import { useCallback, useRef, useState } from 'react'
import { HorizontalGameTemplate } from '../template/horizontal-game-template'
import { manifest } from './manifest'
import {
  createCardJitsuRuntime,
  type CardJitsuRuntimeExtended,
} from './runtime'
import { RuffleStage } from './components/ruffle-stage'
import { InstructionsModal } from './components/instructions-modal'
import { BeltHud } from './components/belt-hud'
import type { NinjaBelt } from './types'

export default function CardJitsuGame() {
  const [currentBelt] = useState<NinjaBelt>('white')
  const [inMatch, setInMatch] = useState(false)
  const [showInstructions, setShowInstructions] = useState(false)

  const runtimeRef = useRef<CardJitsuRuntimeExtended | null>(null)

  // The factory must be referentially stable: `useGameRuntime` recreates the
  // runtime (and the Ruffle-backed CardJitsuSession) whenever `create` changes
  // identity. An unstable factory causes the page's post-mount re-renders
  // (auth resolve, stats fetch, visit announce, counter subscription) to
  // repeatedly destroy and rebuild the `<ruffle-player>`, so the SWF never
  // finishes loading. Everything captured here is stable, so `[]` is correct.
  const wrappedCreateRuntime = useCallback(
    (deps: Parameters<typeof createCardJitsuRuntime>[0]): CardJitsuRuntimeExtended => {
      const runtime = createCardJitsuRuntime(deps) as CardJitsuRuntimeExtended
      runtimeRef.current = runtime

      return {
        ...runtime,
        attach: (host) => {
          const result = runtime.attach(host)
          return {
            dispose: () => {
              result.dispose()
            },
          }
        },
      }
    },
    [],
  )

  const handleExit = useCallback(() => {
    setInMatch(false)
  }, [])

  return (
    <HorizontalGameTemplate
      game={{
        manifest,
        createRuntime: wrappedCreateRuntime,
      }}
      renderCustomHud={(snapshot) => (
        <BeltHud
          currentBelt={runtimeRef.current?.getBelt() ?? currentBelt}
          rank={runtimeRef.current?.getRank?.()}
          progress={runtimeRef.current?.getProgress?.()}
          totalWins={snapshot.score}
        />
      )}
      renderCustomStage={(runtime) => {
        const ext = runtime as unknown as CardJitsuRuntimeExtended
        if (typeof window !== 'undefined') {
          ;(window as unknown as { __cardJitsuSession?: unknown }).__cardJitsuSession = ext.session
        }
        return (
          <div style={{ position: 'relative', width: '100%' }}>
            <RuffleStage
              session={ext.session}
              inMatch={inMatch}
              onStartMatch={(mode) => {
                if (mode === 'belts') {
                  ext.startEarnBelts()
                } else {
                  ext.startChallengeSensei()
                }
                setInMatch(true)
              }}
              onInstructions={() => {
                setShowInstructions(true)
              }}
              onExit={handleExit}
            />
            {showInstructions && (
              <InstructionsModal onClose={() => setShowInstructions(false)} />
            )}
          </div>
        )
      }}
    />
  )
}
