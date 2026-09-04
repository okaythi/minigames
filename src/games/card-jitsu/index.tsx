import { useCallback, useEffect, useRef, useState } from 'react'
import { HorizontalGameTemplate } from '../template/horizontal-game-template'
import { manifest } from './manifest'
import {
  createCardJitsuRuntime,
  type CardJitsuRuntimeExtended,
} from './runtime'
import { RuffleStage } from './components/ruffle-stage'
import { DifficultyControls } from './components/difficulty-controls'
import { DeveloperTools } from './components/developer-tools'
import type { CardData, NinjaBelt, SenseiDifficulty } from './types'
import { getMe } from '../../services/auth-api'

export default function CardJitsuGame() {
  const [currentBelt, setCurrentBelt] = useState<NinjaBelt>('white')
  const [difficulty, setDifficulty] = useState<SenseiDifficulty>('medium')
  const [senseiHand, setSenseiHand] = useState<readonly CardData[]>([])
  const [isThy, setIsThy] = useState(false)

  const runtimeRef = useRef<CardJitsuRuntimeExtended | null>(null)

  useEffect(() => {
    // Check authenticated user for Thy developer privileges
    void getMe().then((profile) => {
      if (profile?.username?.toLowerCase() === 'thy') {
        setIsThy(true)
      }
    })

    if (typeof window !== 'undefined') {
      const isParamThy = window.location.search.includes('user=thy')
      const isLocalThy =
        window.localStorage.getItem('user')?.toLowerCase() === 'thy' ||
        window.localStorage.getItem('dev_user')?.toLowerCase() === 'thy'
      if (isParamThy || isLocalThy) {
        setIsThy(true)
      }
    }
  }, [])

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
          const timer = setInterval(() => {
            if (runtime.session) {
              const stats = runtime.session.getStats()
              setSenseiHand(stats.senseiHand)
            }
          }, 200)

          return {
            dispose: () => {
              clearInterval(timer)
              result.dispose()
            },
          }
        },
      }
    },
    [],
  )

  const handleSelectDifficulty = (mode: SenseiDifficulty) => {
    setDifficulty(mode)
    runtimeRef.current?.setDifficulty(mode)
  }

  const handleSelectBelt = (belt: NinjaBelt) => {
    setCurrentBelt(belt)
    runtimeRef.current?.setBelt(belt)
  }

  return (
    <HorizontalGameTemplate
      game={{
        manifest,
        createRuntime: wrappedCreateRuntime,
      }}
      renderCustomStage={(runtime) => {
        const ext = runtime as unknown as CardJitsuRuntimeExtended
        return <RuffleStage session={ext.session} />
      }}
      renderBottom={() => (
        <>
          <DifficultyControls
            currentBelt={currentBelt}
            difficulty={difficulty}
            onSelectDifficulty={handleSelectDifficulty}
            onSelectBelt={handleSelectBelt}
          />

          {isThy && (
            <DeveloperTools
              senseiHand={senseiHand}
              onForceWin={() => runtimeRef.current?.forceWin()}
              onForceLoss={() => runtimeRef.current?.forceLoss()}
            />
          )}
        </>
      )}
    />
  )
}
