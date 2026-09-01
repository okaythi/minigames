import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import type { GameStatsRecord, StatsMap } from '../../../shared/stats-protocol'
import { fetchAllStats, pushStatsEvent } from './stats-api'
import {
  bankCandy as bankCandyLocal,
  readLocalCounters,
  registerPlay,
  registerScore,
  subscribeLocalCounters,
} from './local-counters'

/**
 * One provider at the app root. It reconciles two sources:
 *
 *  - the edge (Cloudflare Pages Function + KV) for genuinely global counters
 *  - localStorage for the current player's personal best and banked candy
 *
 * Components only ever read `GameStatsView`, so they do not care which source
 * answered.
 */

export interface GameStatsView {
  /** Shown on the card. Falls back to this browser's counter when no KV. */
  readonly plays: number
  readonly personalBest: number | null
  readonly globalRecord: number | null
  readonly candy: number
  /** True when the deployment really is counting across visitors. */
  readonly distributed: boolean
  /** False while the first fetch is in flight or after it failed. */
  readonly synced: boolean
}

export interface StatsController {
  readonly view: (slug: string) => GameStatsView
  readonly beginRun: (slug: string) => void
  readonly finishRun: (slug: string, score: number) => void
  readonly bankCandy: (slug: string, amount: number) => void
}

const StatsContext = createContext<StatsController | null>(null)

export function StatsProvider({ children }: { readonly children: ReactNode }) {
  const [edge, setEdge] = useState<StatsMap | null>(null)
  const [synced, setSynced] = useState(false)
  const [revision, setRevision] = useState(0)
  const pending = useRef(new Set<string>())

  useEffect(() => subscribeLocalCounters(() => setRevision((value) => value + 1)), [])

  useEffect(() => {
    let cancelled = false
    void fetchAllStats().then((payload) => {
      if (cancelled || payload === null) {
        return
      }
      setEdge(payload.games)
      setSynced(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const mergeRemote = useCallback((slug: string, record: GameStatsRecord): void => {
    setEdge((current) => ({ ...(current ?? {}), [slug]: record }))
    setSynced(true)
  }, [])

  const push = useCallback(
    (slug: string, event: { type: 'play' } | { type: 'score'; score: number }): void => {
      if (pending.current.has(slug + event.type)) {
        return
      }
      pending.current.add(slug + event.type)
      void pushStatsEvent(slug, event)
        .then((record) => {
          if (record !== null) {
            mergeRemote(slug, record)
          } else {
            setSynced(false)
          }
        })
        .finally(() => {
          pending.current.delete(slug + event.type)
        })
    },
    [mergeRemote],
  )

  const beginRun = useCallback(
    (slug: string): void => {
      registerPlay(slug)
      setRevision((value) => value + 1)
      push(slug, { type: 'play' })
    },
    [push],
  )

  const finishRun = useCallback(
    (slug: string, score: number): void => {
      registerScore(slug, score)
      setRevision((value) => value + 1)
      push(slug, { type: 'score', score })
    },
    [push],
  )

  const bankCandy = useCallback((slug: string, amount: number): void => {
    bankCandyLocal(slug, amount)
    setRevision((value) => value + 1)
  }, [])

  const value = useMemo<StatsController>(() => {
    const view = (slug: string): GameStatsView => {
      const local = readLocalCounters(slug)
      const remote: GameStatsRecord | undefined = edge?.[slug]
      const distributed = synced && remote !== undefined
      return {
        // Trust the larger of the two until the edge confirms: a stale 0 is
        // worse than a number that only counts down when it must.
        plays: remote === undefined ? local.plays : Math.max(remote.plays, local.plays),
        personalBest: local.best,
        globalRecord: remote?.highscore ?? null,
        candy: local.candy,
        distributed,
        synced,
      }
    }
    return { view, beginRun, finishRun, bankCandy }
    // `revision` intentionally busts the memo when localStorage moves.
  }, [edge, synced, revision, beginRun, finishRun, bankCandy])

  return <StatsContext.Provider value={value}>{children}</StatsContext.Provider>
}

export function useStatsController(): StatsController {
  const controller = useContext(StatsContext)
  if (controller === null) {
    throw new Error('useStatsController must be used inside <StatsProvider>')
  }
  return controller
}

export function useGameStats(slug: string): StatsController & GameStatsView {
  const controller = useStatsController()
  return { ...controller, ...controller.view(slug) }
}
