import type {
  CardData,
  CardJitsuPhase,
  ClashResult,
  MatchStats,
  NinjaBelt,
  SenseiDifficulty,
  WinConditionResult,
} from '../../types'
import { createSenseiDeck, createStarterDeck } from '../deck/cards'
import {
  type ActiveEffects,
  checkWinCondition,
  INITIAL_EFFECTS,
  resolveClash,
} from '../deck/rules'
import { decideSenseiCard } from '../ai/sensei-ai'

export const BELT_TO_RANK: Record<NinjaBelt, number> = {
  white: 0,
  yellow: 1,
  orange: 2,
  green: 3,
  blue: 4,
  red: 5,
  purple: 6,
  brown: 7,
  black: 8,
}

export const RANK_TO_BELT: readonly NinjaBelt[] = [
  'white',
  'yellow',
  'orange',
  'green',
  'blue',
  'red',
  'purple',
  'brown',
  'black',
]

export interface SessionConfig {
  readonly difficulty: SenseiDifficulty
  readonly playerBelt: NinjaBelt
  readonly mode: 'MODE_EXP' | 'MODE_SEN'
  readonly onStateChange?: (stats: MatchStats, phase: CardJitsuPhase) => void
  readonly onClashDone?: (result: ClashResult, winCondition: WinConditionResult) => void
  readonly onGameOver?: (winner: 'player' | 'sensei') => void
  readonly onBeltAwarded?: (newBelt: NinjaBelt) => void
}

export class CardJitsuSession {
  private phase: CardJitsuPhase = 'dialogue'
  private round = 1
  private nextDealtId = 1
  private roomId = 100

  private playerDeck: CardData[] = []
  private senseiDeck: CardData[] = []

  // Track dealt cards by dealtId
  private playerDealtMap = new Map<number, CardData>()
  private senseiDealtMap = new Map<number, CardData>()

  private playerWonCards: CardData[] = []
  private senseiWonCards: CardData[] = []
  private playerWonDealtIds: number[] = []
  private senseiWonDealtIds: number[] = []

  private playerHistory: CardData[] = []
  private playerSelectedCard: CardData | null = null
  private senseiSelectedCard: CardData | null = null
  private activeEffects: ActiveEffects = { ...INITIAL_EFFECTS }
  private lastClash: ClashResult | null = null
  private matchWinner: 'player' | 'sensei' | null = null

  private config: SessionConfig
  private flashBridge: ((action: string, resObj: unknown) => void) | null = null

  constructor(config: SessionConfig) {
    this.config = config
  }

  public setBridge(bridge: (action: string, resObj: unknown) => void): void {
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

  public startMatch(mode?: 'MODE_EXP' | 'MODE_SEN'): void {
    const activeMode = mode ?? this.config.mode
    this.config = { ...this.config, mode: activeMode }

    this.round = 1
    this.nextDealtId = 1
    this.playerWonCards = []
    this.senseiWonCards = []
    this.playerWonDealtIds = []
    this.senseiWonDealtIds = []
    this.playerHistory = []
    this.playerSelectedCard = null
    this.senseiSelectedCard = null
    this.lastClash = null
    this.matchWinner = null
    this.activeEffects = { ...INITIAL_EFFECTS }

    this.playerDealtMap.clear()
    this.senseiDealtMap.clear()

    this.playerDeck = createStarterDeck()
    this.senseiDeck = createSenseiDeck()

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
    roomId: number,
  ): void {
    if (roomId > 0) this.roomId = roomId

    if (action === 'gz') {
      this.handleGetGame()
    } else if (action === 'uz') {
      this.handleUpdateGame()
    } else if (action === 'zm') {
      const subAction = String(args[0] ?? '')
      if (subAction === 'deal') {
        this.handleDealInitialHands()
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
    const beltRank = BELT_TO_RANK[this.config.playerBelt] ?? 0
    this.sendToFlash('gz', [this.roomId, 2, 2])
    this.sendToFlash('jz', [this.roomId, 1, 'Ninja', 1, beltRank])
  }

  private handleUpdateGame(): void {
    const beltRank = BELT_TO_RANK[this.config.playerBelt] ?? 0
    this.sendToFlash('uz', [
      this.roomId,
      '0|Sensei|14|10',
      `1|Ninja|1|${beltRank}`,
    ])
    this.sendToFlash('sz', [this.roomId])
  }

  private handleDealInitialHands(): void {
    this.startMatch()

    const playerDealtStrings: string[] = []
    const senseiDealtStrings: string[] = []

    for (let i = 0; i < 5; i++) {
      const playerCard = this.playerDeck.shift()
      if (playerCard) {
        const dId = this.nextDealtId++
        this.playerDealtMap.set(dId, playerCard)
        playerDealtStrings.push(this.formatCardString(dId, playerCard))
      }

      const senseiCard = this.senseiDeck.shift()
      if (senseiCard) {
        const dId = this.nextDealtId++
        this.senseiDealtMap.set(dId, senseiCard)
        senseiDealtStrings.push(this.formatCardString(dId, senseiCard))
      }
    }

    // Seat 0 = Sensei, Seat 1 = Player
    this.sendToFlash('zm', [this.roomId, 'deal', 0, ...senseiDealtStrings])
    this.sendToFlash('zm', [this.roomId, 'deal', 1, ...playerDealtStrings])
    this.phase = 'choosing'
    this.notify()
  }

  private handlePickCard(playerDealtId: number): void {
    const playerCard = this.playerDealtMap.get(playerDealtId)
    if (!playerCard) return

    this.playerSelectedCard = playerCard
    this.playerHistory.push(playerCard)
    this.playerDealtMap.delete(playerDealtId)

    // Sensei AI Decision
    const senseiHand = Array.from(this.senseiDealtMap.values())
    const senseiChosenCard = decideSenseiCard({
      difficulty: this.config.difficulty,
      playerBelt: this.config.playerBelt,
      senseiHand,
      playerCard,
      senseiWonCards: this.senseiWonCards,
      playerWonCards: this.playerWonCards,
      playerHistory: this.playerHistory,
    })

    // Locate dealt ID for sensei card, or synthesize for dynamic cheat counter
    let senseiDealtId: number | null = null
    for (const [dId, c] of this.senseiDealtMap.entries()) {
      if (c.id === senseiChosenCard.id) {
        senseiDealtId = dId
        break
      }
    }
    if (senseiDealtId === null) {
      senseiDealtId = this.nextDealtId++
    }
    this.senseiDealtMap.delete(senseiDealtId)
    this.senseiSelectedCard = senseiChosenCard

    // Reveal choices to both clients
    this.sendToFlash('zm', [this.roomId, 'pick', 0, senseiDealtId])
    this.sendToFlash('zm', [this.roomId, 'pick', 1, playerDealtId])

    // Resolve Clash
    this.phase = 'clashing'
    const clash = resolveClash(playerCard, senseiChosenCard, this.activeEffects)
    this.lastClash = clash

    let winnerSeat = -1
    if (clash.winner === 'player') {
      winnerSeat = 1
      this.playerWonCards.push(playerCard)
      this.playerWonDealtIds.push(playerDealtId)
    } else if (clash.winner === 'sensei') {
      winnerSeat = 0
      this.senseiWonCards.push(senseiChosenCard)
      this.senseiWonDealtIds.push(senseiDealtId)
    }

    // Power Card packet if triggered
    if (clash.powerTriggered) {
      const sender = winnerSeat >= 0 ? winnerSeat : 1
      const receiver = sender === 1 ? 0 : 1
      this.sendToFlash('zm', [this.roomId, 'power', sender, receiver, clash.powerTriggered])
    }

    // Judge packet
    this.sendToFlash('zm', [this.roomId, 'judge', winnerSeat])

    // Check Win Condition
    const pWin = checkWinCondition(this.playerWonCards)
    const sWin = checkWinCondition(this.senseiWonCards)

    if (pWin.won) {
      this.matchWinner = 'player'
      this.phase = 'game-over'
      this.sendToFlash('czo', [this.roomId, 0, 1, ...this.playerWonDealtIds.slice(-3)])
      this.handleMatchWonByPlayer()
      this.config.onGameOver?.('player')
    } else if (sWin.won) {
      this.matchWinner = 'sensei'
      this.phase = 'game-over'
      this.sendToFlash('czo', [this.roomId, 0, 0, ...this.senseiWonDealtIds.slice(-3)])
      this.config.onGameOver?.('sensei')
    } else {
      // Replenish 1 card to each player
      const nextPlayerCard = this.playerDeck.shift() ?? createStarterDeck()[0]!
      const pId = this.nextDealtId++
      this.playerDealtMap.set(pId, nextPlayerCard)

      const nextSenseiCard = this.senseiDeck.shift() ?? createSenseiDeck()[0]!
      const sId = this.nextDealtId++
      this.senseiDealtMap.set(sId, nextSenseiCard)

      this.sendToFlash('zm', [this.roomId, 'deal', 0, this.formatCardString(sId, nextSenseiCard)])
      this.sendToFlash('zm', [this.roomId, 'deal', 1, this.formatCardString(pId, nextPlayerCard)])
      this.round++
      this.phase = 'choosing'
    }

    this.notify()
    this.config.onClashDone?.(clash, pWin.won ? pWin : sWin)
  }

  private handleMatchWonByPlayer(): void {
    const currentRank = BELT_TO_RANK[this.config.playerBelt] ?? 0
    if (currentRank < 8) {
      const nextBelt = RANK_TO_BELT[currentRank + 1]
      if (nextBelt) {
        this.config = { ...this.config, playerBelt: nextBelt }
        this.sendToFlash('cza', [this.roomId, currentRank + 1])
        this.config.onBeltAwarded?.(nextBelt)
      }
    }
  }

  private formatCardString(dealtId: number, card: CardData): string {
    const elem = card.element === 'fire' ? 'f' : card.element === 'water' ? 'w' : 's'
    const col = card.color.charAt(0).toLowerCase()
    return `${dealtId}|${card.id}|${elem}|${card.value}|${col}|${card.powerId}`
  }

  private sendToFlash(action: string, resObj: unknown): void {
    if (this.flashBridge) {
      this.flashBridge(action, resObj)
    }
  }

  private notify(): void {
    this.config.onStateChange?.(this.getStats(), this.phase)
  }

  public forceWin(): void {
    this.matchWinner = 'player'
    this.phase = 'game-over'
    this.sendToFlash('czo', [this.roomId, 0, 1, 1, 2, 3])
    this.handleMatchWonByPlayer()
    this.config.onGameOver?.('player')
    this.notify()
  }

  public forceLoss(): void {
    this.matchWinner = 'sensei'
    this.phase = 'game-over'
    this.sendToFlash('czo', [this.roomId, 0, 0, 1, 2, 3])
    this.config.onGameOver?.('sensei')
    this.notify()
  }
}
