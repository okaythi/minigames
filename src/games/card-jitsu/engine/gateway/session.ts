import type {
  CardData,
  CardJitsuPhase,
  CardStore,
  ClashResult,
  MatchStats,
  NinjaBelt,
  NinjaElement,
  SenseiDifficulty,
  WinConditionResult,
} from '../../types'
import { ALL_CARDS, CARD_BY_ID, DefaultCardStore, sample } from '../deck/cards'
import {
  type ActiveEffects,
  beatsCard,
  INITIAL_EFFECTS,
  resolveClash,
} from '../deck/rules'

export const BELT_TO_RANK: Record<NinjaBelt, number> = {
  white: 1,
  yellow: 2,
  orange: 3,
  green: 4,
  blue: 5,
  red: 6,
  purple: 7,
  brown: 8,
  black: 9,
}

export const RANK_TO_BELT: Record<number, NinjaBelt> = {
  1: 'white',
  2: 'yellow',
  3: 'orange',
  4: 'green',
  5: 'blue',
  6: 'red',
  7: 'purple',
  8: 'brown',
  9: 'black',
}

export interface SessionConfig {
  readonly difficulty: SenseiDifficulty
  readonly playerBelt: NinjaBelt
  readonly mode: 'MODE_EXP' | 'MODE_SEN'
  readonly playerNick?: string
  readonly playerColor?: number
  readonly cardStore?: CardStore
  readonly onStateChange?: (stats: MatchStats, phase: CardJitsuPhase) => void
  readonly onClashDone?: (result: ClashResult, winCondition: WinConditionResult) => void
  readonly onGameOver?: (winner: 'player' | 'sensei') => void
  readonly onBeltAwarded?: (newBelt: NinjaBelt) => void
}

export interface DealtCard {
  readonly dealtId: number
  readonly card: CardData
}

export class CardJitsuSession {
  private readonly store: CardStore
  private phase: CardJitsuPhase = 'dialogue'
  private round = 1
  private nextDealtId = 1

  private senseiColors: string[] = []

  // Track dealt cards by dealtId
  private playerDealtMap = new Map<number, CardData>()
  private senseiDealtMap = new Map<number, CardData>()

  // Maps playerDealtId -> senseiDealtId paired at deal time (Houdini parity)
  private senseiMoveMap = new Map<number, number>()

  private playerWonCards: CardData[] = []
  private senseiWonCards: CardData[] = []
  private playerWonDealtCards: DealtCard[] = []
  private senseiWonDealtCards: DealtCard[] = []

  private playerHistory: CardData[] = []
  private playerSelectedCard: CardData | null = null
  private senseiSelectedCard: CardData | null = null
  private activeEffects: ActiveEffects = { ...INITIAL_EFFECTS }
  private lastClash: ClashResult | null = null
  private matchWinner: 'player' | 'sensei' | null = null

  private config: SessionConfig
  private flashBridge: ((msg: string) => void) | null = null

  constructor(config: SessionConfig) {
    this.config = config
    this.store = config.cardStore ?? new DefaultCardStore()
  }

  public setBridge(bridge: (msg: string) => void): void {
    this.flashBridge = bridge
  }

  public getPhase(): CardJitsuPhase {
    return this.phase
  }

  public getStats(): MatchStats {
    return {
      round: this.round,
      playerWonCards: [...this.playerWonCards],
      senseiWonCards: [...this.senseiWonCards],
      playerHand: Array.from(this.playerDealtMap.values()),
      senseiHand: Array.from(this.senseiDealtMap.values()),
      playerSelectedCard: this.playerSelectedCard,
      senseiSelectedCard: this.senseiSelectedCard,
      lastClash: this.lastClash,
      matchWinner: this.matchWinner,
    }
  }

  public setDifficulty(difficulty: SenseiDifficulty): void {
    this.config = { ...this.config, difficulty }
    this.notify()
  }

  public setPlayerBelt(belt: NinjaBelt): void {
    this.config = { ...this.config, playerBelt: belt }
    this.notify()
  }

  public getPlayerNick(): string {
    return this.config.playerNick ?? 'Ninja'
  }

  public getPlayerColor(): number {
    return this.config.playerColor ?? 6
  }

  public getPlayerBeltRank(): number {
    return BELT_TO_RANK[this.config.playerBelt] ?? 1
  }

  public getMode(): 'MODE_EXP' | 'MODE_SEN' {
    return this.config.mode
  }

  public startMatch(mode?: 'MODE_EXP' | 'MODE_SEN'): void {
    const activeMode = mode ?? this.config.mode
    this.config = { ...this.config, mode: activeMode }

    this.round = 1
    this.nextDealtId = 1
    this.playerWonCards = []
    this.senseiWonCards = []
    this.playerWonDealtCards = []
    this.senseiWonDealtCards = []
    this.playerHistory = []
    this.playerSelectedCard = null
    this.senseiSelectedCard = null
    this.lastClash = null
    this.matchWinner = null
    this.activeEffects = { ...INITIAL_EFFECTS }

    this.playerDealtMap.clear()
    this.senseiDealtMap.clear()
    this.senseiMoveMap.clear()
    this.senseiColors = []

    this.phase = 'choosing'
    this.notify()
  }

  /**
   * Primary entry point for Flash SmartFox packets intercepted by ExternalInterface.
   */
  public handleFlashPacket(
    _ext: string,
    action: string,
    args: readonly unknown[],
    _type: string,
    _roomId: number,
  ): void {
    if (action === 'gz') {
      this.handleGetGame()
    } else if (action === 'uz') {
      this.handleUpdateGame()
    } else if (action === 'zm') {
      const subAction = String(args[0] ?? '')
      if (subAction === 'deal') {
        this.handleDeal()
      } else if (subAction === 'pick') {
        const pickedDealtId = Number(args[1] ?? 0)
        this.handlePickCard(pickedDealtId)
      }
    } else if (action === 'lz') {
      this.phase = 'dialogue'
      this.notify()
    }
  }

  private handleGetGame(): void {
    this.startMatch()
    const beltRank = this.getPlayerBeltRank()
    const playerNick = this.getPlayerNick()
    const playerColor = this.getPlayerColor()
    this.sendToFlash('gz', [2, 2])
    this.sendToFlash('jz', [1, playerNick, playerColor, beltRank])
  }

  private handleUpdateGame(): void {
    const beltRank = this.getPlayerBeltRank()
    const playerNick = this.getPlayerNick()
    const playerColor = this.getPlayerColor()
    this.sendToFlash('uz', [
      '0|Sensei|14|10',
      `1|${playerNick}|${playerColor}|${beltRank}`,
    ])
    this.sendToFlash('sz', [])
  }

  private getWinCard(playerCard: CardData): CardData {
    if (this.senseiColors.length >= 6) this.senseiColors = []
    const all = ALL_CARDS
    const start = Math.floor(Math.random() * (all.length + 1))
    for (let k = 0; k < all.length; k++) {
      const c = all[(start + k) % all.length]!
      if (!this.senseiColors.includes(c.color) && beatsCard(c, playerCard)) {
        this.senseiColors.push(c.color)
        return c
      }
    }
    return all[Math.floor(Math.random() * all.length)]!
  }

  private handleDeal(): void {
    const canBeatSensei = this.getPlayerBeltRank() >= 9
    // deck = Counter of owned card ids, power cards excluded below black belt
    const deck = new Map<number, number>()
    for (const o of this.store.getOwned()) {
      const card = CARD_BY_ID.get(o.cardId)
      if (!card) continue
      if (!canBeatSensei && card.powerId !== 0) continue
      deck.set(o.cardId, (deck.get(o.cardId) ?? 0) + o.quantity + o.memberQuantity)
    }
    for (const c of this.playerDealtMap.values()) {
      deck.set(c.id, (deck.get(c.id) ?? 0) - 1) // deck - dealt
    }
    const pool: number[] = []
    for (const [id, n] of deck) {
      for (let i = 0; i < n; i++) pool.push(id)
    }
    const need = 5 - this.playerDealtMap.size
    if (need <= 0) return
    const undealt = sample(pool, need)

    const s: string[] = []
    const p: string[] = []
    for (const id of undealt) {
      const card = CARD_BY_ID.get(id)!
      const pId = this.nextDealtId++
      this.playerDealtMap.set(pId, card)
      p.push(this.formatCardString(pId, card))

      const senseiCard = canBeatSensei
        ? ALL_CARDS[Math.floor(Math.random() * ALL_CARDS.length)]!
        : this.getWinCard(card)
      const sId = this.nextDealtId++
      this.senseiDealtMap.set(sId, senseiCard)
      s.push(this.formatCardString(sId, senseiCard))
      this.senseiMoveMap.set(pId, sId)
    }

    this.sendToFlash('zm', ['deal', 0, ...s])
    this.sendToFlash('zm', ['deal', 1, ...p])
    this.phase = 'choosing'
    this.notify()
  }

  private handlePickCard(playerDealtId: number): void {
    const playerCard = this.playerDealtMap.get(playerDealtId)
    if (!playerCard) return

    const senseiDealtId = this.senseiMoveMap.get(playerDealtId)
    if (senseiDealtId === undefined) return
    const senseiCard = this.senseiDealtMap.get(senseiDealtId)
    if (!senseiCard) return

    // Remove played cards from hands
    this.playerDealtMap.delete(playerDealtId)
    this.senseiDealtMap.delete(senseiDealtId)
    this.senseiMoveMap.delete(playerDealtId)

    this.playerSelectedCard = playerCard
    this.senseiSelectedCard = senseiCard
    this.playerHistory.push(playerCard)

    // 1. Reveal choices (pick 0, pick 1)
    this.sendToFlash('zm', ['pick', 0, senseiDealtId])
    this.sendToFlash('zm', ['pick', 1, playerDealtId])

    this.phase = 'clashing'

    // 2. Resolve clash
    const clash = resolveClash(playerCard, senseiCard, this.activeEffects)
    this.lastClash = clash

    // 3. On-played powers (1, 16, 17, 18) - sent for both players regardless of outcome
    const ON_PLAYED = new Set([1, 16, 17, 18])
    if (playerCard.powerId && ON_PLAYED.has(playerCard.powerId)) {
      this.sendToFlash('zm', ['power', 1, 0, playerCard.powerId])
    }
    if (senseiCard.powerId && ON_PLAYED.has(senseiCard.powerId)) {
      this.sendToFlash('zm', ['power', 0, 1, senseiCard.powerId])
    }

    let winnerSeat = -1
    let winningCard: CardData | null = null

    if (clash.winner === 'player') {
      winnerSeat = 1
      winningCard = playerCard
      this.playerWonCards.push(playerCard)
      this.playerWonDealtCards.push({ dealtId: playerDealtId, card: playerCard })
    } else if (clash.winner === 'sensei') {
      winnerSeat = 0
      winningCard = senseiCard
      this.senseiWonCards.push(senseiCard)
      this.senseiWonDealtCards.push({ dealtId: senseiDealtId, card: senseiCard })
    }

    // 4. On-scored powers (winner's card only)
    if (winnerSeat !== -1 && winningCard && winningCard.powerId && !ON_PLAYED.has(winningCard.powerId)) {
      const affectsOwnPlayer = winningCard.powerId === 2 // AffectsOwnPlayer
      const loserSeat = winnerSeat === 1 ? 0 : 1
      const sender = winnerSeat
      const recipient = affectsOwnPlayer ? winnerSeat : loserSeat
      this.sendToFlash('zm', ['power', sender, recipient, winningCard.powerId])
    }

    // 5. Winning combination check
    const pWin = this.getWinningDealtIds(this.playerWonDealtCards)
    const sWin = this.getWinningDealtIds(this.senseiWonDealtCards)

    if (pWin !== null) {
      this.matchWinner = 'player'
      this.phase = 'game-over'
      this.sendToFlash('czo', [0, 1, ...pWin])
      this.handleMatchWonByPlayer()
      this.config.onGameOver?.('player')
    } else if (sWin !== null) {
      this.matchWinner = 'sensei'
      this.phase = 'game-over'
      this.sendToFlash('czo', [0, 0, ...sWin])
      this.config.onGameOver?.('sensei')
    }

    // 6. Judge packet (sent AFTER czo/cza)
    this.sendToFlash('zm', ['judge', winnerSeat])

    if (pWin === null && sWin === null) {
      this.round++
      this.phase = 'choosing'
    }

    this.notify()
    this.config.onClashDone?.(
      clash,
      pWin !== null
        ? { won: true, triadType: 'different-elements', winningCards: this.playerWonCards }
        : sWin !== null
          ? { won: true, triadType: 'different-elements', winningCards: this.senseiWonCards }
          : { won: false },
    )
  }

  private getWinningDealtIds(
    wonDealtCards: readonly DealtCard[],
  ): number[] | null {
    // Group by element
    const byElem: Record<NinjaElement, DealtCard[]> = {
      f: [],
      w: [],
      s: [],
    }
    for (const item of wonDealtCards) {
      byElem[item.card.element].push(item)
    }

    // 1. Check same-element 3 different colors
    for (const element of ['f', 'w', 's'] as const) {
      const cards = byElem[element]
      const colorCards: DealtCard[] = []
      const colors = new Set<string>()
      for (const item of cards) {
        if (!colors.has(item.card.color)) {
          colors.add(item.card.color)
          colorCards.push(item)
          if (colorCards.length === 3) {
            return colorCards.map((c) => c.dealtId)
          }
        }
      }
    }

    // 2. Check different elements 3 different colors (1 fire, 1 water, 1 snow)
    for (const f of byElem.f) {
      for (const w of byElem.w) {
        if (f.card.color === w.card.color) continue
        for (const s of byElem.s) {
          if (s.card.color === f.card.color || s.card.color === w.card.color) continue
          return [f.dealtId, w.dealtId, s.dealtId]
        }
      }
    }

    return null
  }

  private handleMatchWonByPlayer(): void {
    const currentRank = BELT_TO_RANK[this.config.playerBelt] ?? 1
    if (currentRank < 9) {
      const nextRank = currentRank + 1
      const nextBelt = RANK_TO_BELT[nextRank]
      if (nextBelt) {
        this.config = { ...this.config, playerBelt: nextBelt }
        this.sendToFlash('cza', [nextRank])
        this.config.onBeltAwarded?.(nextBelt)
      }
    }
  }

  private formatCardString(dealtId: number, card: CardData): string {
    return `${dealtId}|${card.id}|${card.element}|${card.value}|${card.color}|${card.powerId}`
  }

  private sendToFlash(action: string, args: readonly unknown[]): void {
    this.flashBridge?.(['', 'xt', action, '-1', ...args.map(String), ''].join('%'))
  }

  private notify(): void {
    this.config.onStateChange?.(this.getStats(), this.phase)
  }

  public forceWin(): void {
    this.matchWinner = 'player'
    this.phase = 'game-over'
    const fallbackIds = this.playerWonDealtCards.map((c) => c.dealtId).slice(-3)
    const ids = fallbackIds.length === 3 ? fallbackIds : [1, 2, 3]
    this.sendToFlash('czo', [0, 1, ...ids])
    this.handleMatchWonByPlayer()
    this.config.onGameOver?.('player')
    this.notify()
  }

  public forceLoss(): void {
    this.matchWinner = 'sensei'
    this.phase = 'game-over'
    const fallbackIds = this.senseiWonDealtCards.map((c) => c.dealtId).slice(-3)
    const ids = fallbackIds.length === 3 ? fallbackIds : [1, 2, 3]
    this.sendToFlash('czo', [0, 0, ...ids])
    this.config.onGameOver?.('sensei')
    this.notify()
  }
}
