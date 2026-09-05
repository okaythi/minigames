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
import type {
  GameStatsRecord,
  PlayerRecord,
  StatsMap,
} from '../../../shared/stats-protocol'
import { announceVisit, fetchAllStats, pushStatsEvent } from './stats-api'
import { claimVisitAnnouncement } from './player-identity'
import type { GameFinishDetails } from '../../games/template/types'
import {
  bankCandy as bankCandyLocal,
  readLocalCounters,
  registerPlay,
  registerScore,
  setGlobalCandyLocal,
  subscribeLocalCounters,
} from './local-counters'

/**
 * One provider at the app root. It reconciles two sources:
 *
 *  - the edge (Cloudflare Pages Function + D1) for genuinely global counters
 *  - localStorage for the current player's personal best and banked candy
 *
 * Components only ever read `GameStatsView`, so they do not care which source
 * answered.
 */

export interface GameStatsView {
  /** Shown on the card. Falls back to this browser's counter when the edge is dark. */
  readonly plays: number
  readonly personalBest: number | null
  readonly globalRecord: number | null
  readonly candy: number
  /** Game milestones or difficulties completed by this player. */
  readonly completedDifficulties: readonly string[]
  /** True when the deployment really is counting across visitors. */
  readonly distributed: boolean
  /** False while the first fetch is in flight or after it failed. */
  readonly synced: boolean
}

export function broadcastCandyUpdate(candy: number): void {
  window.dispatchEvent(new CustomEvent('nx:candy-updated', { detail: { candy } }))
}

export interface StatsController {
  /** Distinct anonymous visitors, straight from the edge. */
  readonly uniquePlayers: number
  /** Unified global candy bank across all games and shops. */
  readonly totalCandy: number
  readonly view: (slug: string) => GameStatsView
  readonly beginRun: (slug: string) => void
  readonly finishRun: (slug: string, score: number, details?: GameFinishDetails) => void
  readonly bankCandy: (slug: string, amount: number) => void
  readonly syncCandy: (candy: number) => void
  readonly refresh: () => Promise<void>
}

const StatsContext = createContext<StatsController | null>(null)

export function StatsProvider({ children }: { readonly children: ReactNode }) {
  const [edge, setEdge] = useState<StatsMap | null>(null)
  const [playerRecord, setPlayerRecord] = useState<PlayerRecord | null>(null)
  const [uniquePlayers, setUniquePlayers] = useState(0)
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
      setPlayerRecord(payload.player)
      setUniquePlayers(payload.uniquePlayers)
      setSynced(true)

      if (payload.player) {
        setGlobalCandyLocal(payload.player.candy)
      }
    })

    // One visit per page load: counts a player without counting a run. The
    // module-level claim keeps React's double-mount from sending it twice.
    if (claimVisitAnnouncement()) {
      void announceVisit().then((count) => {
        if (!cancelled && count !== null) {
          setUniquePlayers((current) => Math.max(current, count))
        }
      })
    }

    return () => {
      cancelled = true
    }
  }, [])

  const mergeRemote = useCallback((slug: string, record: GameStatsRecord, player: PlayerRecord | null): void => {
    setEdge((current) => ({ ...(current ?? {}), [slug]: record }))
    if (player !== null) {
      setPlayerRecord(player)
    }
    setSynced(true)
  }, [])

  const push = useCallback(
    (
      slug: string,
      event:
        | { type: 'play' }
        | ({ type: 'score'; score: number } & GameFinishDetails)
        | { type: 'candy'; amount: number },
    ): void => {
      if (event.type !== 'candy') {
        if (pending.current.has(slug + event.type)) {
          return
        }
        pending.current.add(slug + event.type)
      }
      void pushStatsEvent(slug, event)
        .then((result) => {
          if (result !== null && result.stats !== null) {
            mergeRemote(slug, result.stats, result.player)
          } else {
            setSynced(false)
          }
        })
        .finally(() => {
          if (event.type !== 'candy') {
            pending.current.delete(slug + event.type)
          }
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
    (slug: string, score: number, details?: GameFinishDetails): void => {
      registerScore(slug, score)
      setRevision((value) => value + 1)
      push(slug, details === undefined ? { type: 'score', score } : { type: 'score', score, ...details })
    },
    [push],
  )

  const syncCandy = useCallback((candy: number): void => {
    const safe = Math.max(0, Math.floor(candy))
    setPlayerRecord((prev) => (prev ? { ...prev, candy: safe } : prev))
    setGlobalCandyLocal(safe)
    setRevision((value) => value + 1)
  }, [])

  useEffect(() => {
    const handleCandyUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{ candy: number }>
      if (typeof customEvent.detail?.candy === 'number') {
        syncCandy(customEvent.detail.candy)
      }
    }
    window.addEventListener('nx:candy-updated', handleCandyUpdate)
    return () => window.removeEventListener('nx:candy-updated', handleCandyUpdate)
  }, [syncCandy])

  const bankCandy = useCallback(
    (slug: string, amount: number): void => {
      const updated = bankCandyLocal(slug, amount)
      setPlayerRecord((prev) => (prev ? { ...prev, candy: updated.candy } : prev))
      setRevision((value) => value + 1)
      push(slug, { type: 'candy', amount })
    },
    [push],
  )

  const refresh = useCallback(async (): Promise<void> => {
    const payload = await fetchAllStats()
    if (payload !== null) {
      setEdge(payload.games)
      setPlayerRecord(payload.player)
      setUniquePlayers(payload.uniquePlayers)
      setSynced(true)
      if (payload.player) {
        setGlobalCandyLocal(payload.player.candy)
      }
    }
    setRevision((value) => value + 1)
  }, [])

  const value = useMemo<StatsController>(() => {
    const view = (slug: string): GameStatsView => {
      const local = readLocalCounters(slug)
      const remote: GameStatsRecord | undefined = edge?.[slug]
      const distributed = synced && remote !== undefined
      const candy = playerRecord !== null ? playerRecord.candy : local.candy
      return {
        // Trust the larger of the two until the edge confirms: a stale 0 is
        // worse than a number that only counts down when it must.
        plays: remote === undefined ? local.plays : Math.max(remote.plays, local.plays),
        personalBest: local.best,
        globalRecord: remote?.highscore ?? null,
        candy,
        completedDifficulties: playerRecord?.games[slug]?.completedDifficulties ?? [],
        distributed,
        synced,
      }
    }
    const totalCandy = playerRecord !== null ? playerRecord.candy : readLocalCounters('avoid-the-spikes').candy
    return { view, beginRun, finishRun, bankCandy, syncCandy, refresh, uniquePlayers, totalCandy }
    // `revision` intentionally busts the memo when localStorage moves.
  }, [edge, playerRecord, synced, revision, beginRun, finishRun, bankCandy, syncCandy, refresh, uniquePlayers])

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
