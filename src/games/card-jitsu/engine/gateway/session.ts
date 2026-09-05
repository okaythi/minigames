import type {
  CardData,
  CardJitsuPhase,
  CardStore,
  ClashResult,
  MatchEndDecision,
  MatchEndResult,
  MatchStats,
  NinjaBelt,
  OnMatchEndCallback,
  SenseiDifficulty,
  WinConditionResult,
} from '../../types'
import {
  CARD_BY_ID,
  DEALABLE_CARDS,
  DEALABLE_CARD_BY_ID,
  DEALABLE_IDS,
  DefaultCardStore,
  sample,
} from '../deck/cards'
import {
  type ActiveCardState,
  type ActivePowerCard,
  AffectsOwnPlayer,
  OnPlayed,
  adjustCardValues,
  beatsCard,
  getWinningCombo,
  getWinnerSeatId,
  hasCardsToPlay,
  onPlayedEffects,
  onScoredEffects,
} from '../deck/rules'
import {
  type BotContext,
  type BotPolicy,
  createBotPolicy,
} from '../ai/bot-policy'

export const PLAYER_SEAT = 0
export const OPP_SEAT = 1
export const CZO_OPCODE = 0
export const DEFAULT_MATCH_COINS = 20
export const TIE_SEAT = -1

export function getOpponentSeat(seat: number): number {
  return seat === PLAYER_SEAT ? OPP_SEAT : PLAYER_SEAT
}

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

export type GameMode = 'sensei' | 'belts' | 'MODE_SEN' | 'MODE_EXP'

export interface SessionConfig {
  readonly difficulty: SenseiDifficulty
  readonly playerBelt: NinjaBelt
  readonly mode: GameMode
  readonly playerNick?: string | undefined
  readonly playerColor?: number | undefined
  readonly cardStore?: CardStore | undefined
  readonly opponentPolicy?: BotPolicy | undefined
  readonly onStateChange?: ((stats: MatchStats, phase: CardJitsuPhase) => void) | undefined
  readonly onClashDone?: ((result: ClashResult, winCondition: WinConditionResult) => void) | undefined
  readonly onMatchEnd?: OnMatchEndCallback | undefined
  readonly onGameOver?: ((winner: 'player' | 'sensei') => void) | undefined
  readonly onBeltAwarded?: ((newBelt: NinjaBelt) => void) | undefined
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
  private botNick = 'Ninja Student'
  private botColor = 2
  private botPolicy: BotPolicy | null = null

  // Track dealt cards by dealtId
  private playerDealtMap = new Map<number, CardData>()
  private oppDealtMap = new Map<number, CardData>()

  // Maps playerDealtId -> oppDealtId paired at deal time (Houdini Sensei parity)
  private senseiMoveMap = new Map<number, number>()

  private playerWonCards: CardData[] = []
  private oppWonCards: CardData[] = []
  private playerWonDealtCards: DealtCard[] = []
  private oppWonDealtCards: DealtCard[] = []

  private playerHistory: CardData[] = []
  private playerSelectedCard: CardData | null = null
  private oppSelectedCard: CardData | null = null
  private powers = new Map<number, ActivePowerCard>()
  private discards: number[] = []
  private lastClash: ClashResult | null = null
  private matchWinner: 'player' | 'sensei' | null = null
  private senseiCardPlayed = false
  private matchEnded = false

  private config: SessionConfig
  private flashBridge: ((msg: string) => void) | null = null

  constructor(config: SessionConfig) {
    this.config = config
    this.store = config.cardStore ?? new DefaultCardStore()

    // §2 Filter player's owned cards against dealable pool; warn once at startup
    const owned = this.store.getOwned()
    const droppedIds: number[] = []
    for (const item of owned) {
      if (!DEALABLE_IDS.has(item.cardId)) {
        droppedIds.push(item.cardId)
      }
    }
    if (droppedIds.length > 0) {
      console.warn(
        '[Card-Jitsu Session] Dropping owned cards outside dealable media pool:',
        droppedIds,
      )
    }

    // Initialize bot attributes for belts mode
    const botNames = [
      'Ninja Rookie',
      'Ninja Dot',
      'Ninja Gary',
      'Ninja Cadence',
      'Ninja Jet',
      'Shadow Ninja',
      'Frost Ninja',
    ]
    this.botNick = botNames[Math.floor(Math.random() * botNames.length)]!
    const botColors = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
    this.botColor = botColors[Math.floor(Math.random() * botColors.length)]!
    const botRank = Math.min(this.getPlayerBeltRank() + 1, 9)
    this.botPolicy = config.opponentPolicy ?? createBotPolicy(botRank)
  }

  public setBridge(bridge: (msg: string) => void): void {
    this.flashBridge = bridge
  }

  public isSenseiMode(): boolean {
    return this.config.mode === 'sensei' || this.config.mode === 'MODE_SEN'
  }

  public getPhase(): CardJitsuPhase {
    return this.phase
  }

  public getStats(): MatchStats {
    return {
      round: this.round,
      playerWonCards: [...this.playerWonCards],
      senseiWonCards: [...this.oppWonCards],
      playerHand: Array.from(this.playerDealtMap.values()),
      senseiHand: Array.from(this.oppDealtMap.values()),
      playerSelectedCard: this.playerSelectedCard,
      senseiSelectedCard: this.oppSelectedCard,
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
    const botRank = Math.min(this.getPlayerBeltRank() + 1, 9)
    this.botPolicy = this.config.opponentPolicy ?? createBotPolicy(botRank)
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

  public getMode(): GameMode {
    return this.config.mode
  }

  public startMatch(mode?: GameMode): void {
    if (mode) {
      this.config = { ...this.config, mode }
    }

    this.round = 1
    this.nextDealtId = 1
    this.playerWonCards = []
    this.oppWonCards = []
    this.playerWonDealtCards = []
    this.oppWonDealtCards = []
    this.playerHistory = []
    this.playerSelectedCard = null
    this.oppSelectedCard = null
    this.powers.clear()
    this.discards = []
    this.lastClash = null
    this.matchWinner = null
    this.senseiCardPlayed = false
    this.matchEnded = false

    this.playerDealtMap.clear()
    this.oppDealtMap.clear()
    this.senseiMoveMap.clear()
    this.senseiColors = []

    const botRank = Math.min(this.getPlayerBeltRank() + 1, 9)
    this.botPolicy = this.config.opponentPolicy ?? createBotPolicy(botRank)

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
      // Houdini answers with cjsi stamp info before quitting
      this.sendToFlash('cjsi', [])
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
    this.sendToFlash('jz', [PLAYER_SEAT, playerNick, playerColor, beltRank])
  }

  private handleUpdateGame(): void {
    const beltRank = this.getPlayerBeltRank()
    const playerNick = this.getPlayerNick()
    const playerColor = this.getPlayerColor()

    if (this.isSenseiMode()) {
      this.sendToFlash('uz', [
        `${PLAYER_SEAT}|${playerNick}|${playerColor}|${beltRank}`,
        `${OPP_SEAT}|Sensei|14|10`,
      ])
    } else {
      const botRank = Math.min(beltRank + 1, 9)
      this.sendToFlash('uz', [
        `${PLAYER_SEAT}|${playerNick}|${playerColor}|${beltRank}`,
        `${OPP_SEAT}|${this.botNick}|${this.botColor}|${botRank}`,
      ])
    }
    this.sendToFlash('sz', [])
  }

  private getWinCard(playerCard: CardData): CardData {
    if (this.senseiColors.length >= 6) this.senseiColors = []
    const dealable = DEALABLE_CARDS
    const start = Math.floor(Math.random() * (dealable.length + 1))
    for (let k = 0; k < dealable.length; k++) {
      const c = dealable[(start + k) % dealable.length]!
      if (!this.senseiColors.includes(c.color) && beatsCard(c, playerCard)) {
        this.senseiColors.push(c.color)
        return c
      }
    }
    return dealable[Math.floor(Math.random() * dealable.length)]!
  }

  private handleDeal(): void {
    const isSensei = this.isSenseiMode()
    const canBeatSensei = this.getPlayerBeltRank() >= 9

    // Player pool from owned cards within dealable pool
    const deck = new Map<number, number>()
    for (const o of this.store.getOwned()) {
      if (!DEALABLE_IDS.has(o.cardId)) continue
      const card = CARD_BY_ID.get(o.cardId)
      if (!card) continue
      if (isSensei && !canBeatSensei && card.powerId !== 0) continue
      deck.set(o.cardId, (deck.get(o.cardId) ?? 0) + o.quantity + o.memberQuantity)
    }
    for (const c of this.playerDealtMap.values()) {
      deck.set(c.id, (deck.get(c.id) ?? 0) - 1)
    }

    const playerPool: number[] = []
    for (const [id, n] of deck) {
      for (let i = 0; i < n; i++) playerPool.push(id)
    }
    // Fallback if owned pool depleted
    if (playerPool.length === 0) {
      for (const card of DEALABLE_CARDS) {
        if (!isSensei || canBeatSensei || card.powerId === 0) {
          playerPool.push(card.id)
        }
      }
    }

    const needPlayer = 5 - this.playerDealtMap.size
    if (needPlayer <= 0) return
    const undealtPlayer = sample(playerPool, needPlayer)

    const playerStrings: string[] = []
    const oppStrings: string[] = []

    if (isSensei) {
      for (const id of undealtPlayer) {
        const card = DEALABLE_CARD_BY_ID.get(id) ?? CARD_BY_ID.get(id)!
        const pId = this.nextDealtId++
        this.playerDealtMap.set(pId, card)
        playerStrings.push(this.formatCardString(pId, card))

        const senseiCard = canBeatSensei
          ? DEALABLE_CARDS[Math.floor(Math.random() * DEALABLE_CARDS.length)]!
          : this.getWinCard(card)
        const sId = this.nextDealtId++
        this.oppDealtMap.set(sId, senseiCard)
        oppStrings.push(this.formatCardString(sId, senseiCard))
        this.senseiMoveMap.set(pId, sId)
      }
    } else {
      // 2-Player Belts Bot Honest Deal
      for (const id of undealtPlayer) {
        const card = DEALABLE_CARD_BY_ID.get(id) ?? CARD_BY_ID.get(id)!
        const pId = this.nextDealtId++
        this.playerDealtMap.set(pId, card)
        playerStrings.push(this.formatCardString(pId, card))
      }

      const needOpp = 5 - this.oppDealtMap.size
      const oppSampleCards = sample(DEALABLE_CARDS, needOpp)
      for (const oppCard of oppSampleCards) {
        const sId = this.nextDealtId++
        this.oppDealtMap.set(sId, oppCard)
        oppStrings.push(this.formatCardString(sId, oppCard))
      }
    }

    // §1 Send PLAYER_SEAT then OPP_SEAT
    this.sendToFlash('zm', ['deal', PLAYER_SEAT, ...playerStrings])
    this.sendToFlash('zm', ['deal', OPP_SEAT, ...oppStrings])
    this.phase = 'choosing'
    this.notify()
  }

  private handlePickCard(playerDealtId: number): void {
    if (this.matchEnded) return
    const playerCard = this.playerDealtMap.get(playerDealtId)
    if (!playerCard) return

    this.playerDealtMap.delete(playerDealtId)
    this.playerSelectedCard = playerCard
    this.playerHistory.push(playerCard)

    if (this.isSenseiMode()) {
      const oppDealtId = this.senseiMoveMap.get(playerDealtId)
      if (oppDealtId === undefined) return
      const oppCard = this.oppDealtMap.get(oppDealtId)
      if (!oppCard) return

      this.oppDealtMap.delete(oppDealtId)
      this.senseiMoveMap.delete(playerDealtId)
      this.oppSelectedCard = oppCard

      // Reveal both cards
      this.sendToFlash('zm', ['pick', PLAYER_SEAT, playerDealtId])
      this.sendToFlash('zm', ['pick', OPP_SEAT, oppDealtId])
      this.phase = 'clashing'
      this.notify()

      void this.executeClash(playerDealtId, playerCard, oppDealtId, oppCard)
    } else {
      // §5 2-player bot protocol: immediately reveal player pick, wait realism delay, then bot picks
      this.sendToFlash('zm', ['pick', PLAYER_SEAT, playerDealtId])
      this.phase = 'choosing'
      this.notify()

      const botContext: BotContext = {
        hand: Array.from(this.oppDealtMap.entries()).map(([dealtId, card]) => ({ dealtId, card })),
        myBank: [...this.oppWonCards],
        oppBank: [...this.playerWonCards],
        oppHand: Array.from(this.playerDealtMap.entries()).map(([dealtId, card]) => ({ dealtId, card })),
        oppHistory: [...this.playerHistory],
        activePowers: this.powers,
      }

      const botDealtId = this.botPolicy?.pick(botContext) ?? Array.from(this.oppDealtMap.keys())[0]!
      const oppCard = this.oppDealtMap.get(botDealtId)
      if (!oppCard) return
      this.oppDealtMap.delete(botDealtId)
      this.oppSelectedCard = oppCard

      const realismDelayMs = Math.floor(Math.random() * 1100) + 400
      setTimeout(() => {
        if (this.matchEnded) return
        this.sendToFlash('zm', ['pick', OPP_SEAT, botDealtId])
        this.phase = 'clashing'
        this.notify()

        void this.executeClash(playerDealtId, playerCard, botDealtId, oppCard)
      }, realismDelayMs)
    }
  }

  /**
   * §7 Verbatim Houdini clash resolution pipeline
   */
  private async executeClash(
    playerDealtId: number,
    playerCard: CardData,
    oppDealtId: number,
    oppCard: CardData,
  ): Promise<void> {
    const firstCard: ActiveCardState = {
      element: playerCard.element,
      value: playerCard.value,
      card: playerCard,
      player: PLAYER_SEAT,
      opponent: OPP_SEAT,
    }

    const secondCard: ActiveCardState = {
      element: oppCard.element,
      value: oppCard.value,
      card: oppCard,
      player: OPP_SEAT,
      opponent: PLAYER_SEAT,
    }

    // 1. adjust_card_values (prev-round powers 1, 2, 3)
    adjustCardValues(firstCard, secondCard, this.powers)

    // 2. powers = {}
    this.powers.clear()

    // 3. on_played_effects (16-18 replace element now; 1 stored)
    onPlayedEffects(firstCard, secondCard, this.powers)

    // Send on-played power packets
    if (playerCard.powerId && OnPlayed.has(playerCard.powerId)) {
      this.sendToFlash('zm', ['power', PLAYER_SEAT, OPP_SEAT, playerCard.powerId])
    }
    if (oppCard.powerId && OnPlayed.has(oppCard.powerId)) {
      this.sendToFlash('zm', ['power', OPP_SEAT, PLAYER_SEAT, oppCard.powerId])
    }

    // 4. get_winner_seat_id
    const winnerSeatId = getWinnerSeatId(firstCard, secondCard)

    // 5. on_scored_effects (2, 3, 13, 14, 15 stored; 4-12 discard now)
    this.discards = []
    let winningCard: CardData | null = null

    if (winnerSeatId === PLAYER_SEAT) {
      winningCard = playerCard
      this.playerWonCards.push(playerCard)
      this.playerWonDealtCards.push({ dealtId: playerDealtId, card: playerCard })
      onScoredEffects(
        winnerSeatId,
        firstCard,
        secondCard,
        this.powers,
        this.oppWonCards,
        this.discards,
        this.oppWonDealtCards,
      )
    } else if (winnerSeatId === OPP_SEAT) {
      winningCard = oppCard
      this.oppWonCards.push(oppCard)
      this.oppWonDealtCards.push({ dealtId: oppDealtId, card: oppCard })
      onScoredEffects(
        winnerSeatId,
        firstCard,
        secondCard,
        this.powers,
        this.playerWonCards,
        this.discards,
        this.playerWonDealtCards,
      )
    }

    // Send on-scored power packet
    if (winnerSeatId !== TIE_SEAT && winningCard && winningCard.powerId && !OnPlayed.has(winningCard.powerId)) {
      const affectsOwn = AffectsOwnPlayer.has(winningCard.powerId)
      const sender = winnerSeatId
      const loserSeat = getOpponentSeat(winnerSeatId)
      const recipient = affectsOwn ? winnerSeatId : loserSeat
      this.sendToFlash('zm', ['power', sender, recipient, winningCard.powerId, ...this.discards])
      this.discards = []
    }

    // Check stamp condition for Sensei card (#256)
    if (playerCard.id === 256 || oppCard.id === 256) {
      this.senseiCardPlayed = true
    }

    // UI read-only clash result
    const reason =
      firstCard.element !== secondCard.element
        ? 'element'
        : firstCard.value === secondCard.value
          ? 'tie'
          : 'value'
    this.lastClash = {
      playerCard,
      senseiCard: oppCard,
      winner: winnerSeatId === PLAYER_SEAT ? 'player' : winnerSeatId === OPP_SEAT ? 'sensei' : 'tie',
      reason,
      powerTriggered: winningCard?.powerId && winningCard.powerId > 0 ? winningCard.powerId : undefined,
      message:
        winnerSeatId === PLAYER_SEAT
          ? `${playerCard.name ?? 'Player'} triumphs!`
          : winnerSeatId === OPP_SEAT
            ? `${oppCard.name ?? 'Opponent'} triumphs!`
            : 'Equal power! Both cards clash and dissipate!',
    }

    // 6. Win condition check
    if (winnerSeatId !== TIE_SEAT) {
      const wonDealtList =
        winnerSeatId === PLAYER_SEAT ? this.playerWonDealtCards : this.oppWonDealtCards
      const winCombo = getWinningCombo(wonDealtList)

      if (winCombo !== null) {
        this.sendToFlash('czo', [
          CZO_OPCODE,
          DEFAULT_MATCH_COINS,
          winnerSeatId,
          ...winCombo.winningDealtIds,
        ])
        await this.finalizeMatchEnd(winnerSeatId, winCombo.winMethod)
        return
      }
    }

    // 7. Limiter lockout check (has_cards_to_play)
    const pHand = Array.from(this.playerDealtMap.entries()).map(([dealtId, card]) => ({
      dealtId,
      card,
    }))
    const oHand = Array.from(this.oppDealtMap.entries()).map(([dealtId, card]) => ({
      dealtId,
      card,
    }))

    if (!hasCardsToPlay(PLAYER_SEAT, pHand, this.powers)) {
      this.sendToFlash('czo', [CZO_OPCODE, DEFAULT_MATCH_COINS, OPP_SEAT])
      await this.finalizeMatchEnd(OPP_SEAT, 'no-cards')
      return
    }

    if (!hasCardsToPlay(OPP_SEAT, oHand, this.powers)) {
      this.sendToFlash('czo', [CZO_OPCODE, DEFAULT_MATCH_COINS, PLAYER_SEAT])
      await this.finalizeMatchEnd(PLAYER_SEAT, 'no-cards')
      return
    }

    // 8. Round not ended: send judge packet
    this.sendToFlash('zm', ['judge', winnerSeatId])
    this.round++
    this.phase = 'choosing'
    this.notify()
    this.config.onClashDone?.(this.lastClash, { won: false })
  }

  /**
   * §3 Match-end lifecycle: awaits product onMatchEnd decision before judge packet
   */
  private async finalizeMatchEnd(
    winnerSeatId: number,
    winMethod: 'same-element' | 'three-elements' | 'no-cards' | 'forfeit',
  ): Promise<void> {
    this.matchEnded = true
    this.phase = 'game-over'
    this.matchWinner = winnerSeatId === PLAYER_SEAT ? 'player' : 'sensei'

    const isPlayerWin = winnerSeatId === PLAYER_SEAT
    const winnerBank = isPlayerWin ? this.playerWonCards : this.oppWonCards
    const loserBank = isPlayerWin ? this.oppWonCards : this.playerWonCards

    const matchResult: MatchEndResult = {
      winner: isPlayerWin ? 'player' : 'opponent',
      mode: this.isSenseiMode() ? 'sensei' : 'belts',
      rounds: this.round,
      playerBank: [...this.playerWonCards],
      opponentBank: [...this.oppWonCards],
      winMethod,
      flawless: loserBank.length === 0,
      fullDojo: winnerBank.length >= 9,
      senseiCardPlayed: this.senseiCardPlayed,
    }

    let decision: MatchEndDecision = {}
    if (this.config.onMatchEnd) {
      try {
        const timeoutPromise = new Promise<MatchEndDecision>((resolve) =>
          setTimeout(() => resolve({}), 2000),
        )
        decision = await Promise.race([
          Promise.resolve(this.config.onMatchEnd(matchResult)),
          timeoutPromise,
        ])
      } catch (err) {
        console.warn('[Card-Jitsu Session] onMatchEnd error:', err)
      }
    }

    if (decision?.awardRank !== undefined) {
      this.sendToFlash('cza', [decision.awardRank])
    }

    this.sendToFlash('zm', ['judge', winnerSeatId])
    this.config.onGameOver?.(this.matchWinner)
    this.notify()
    if (this.lastClash) {
      this.config.onClashDone?.(this.lastClash, {
        won: true,
        triadType: winMethod === 'same-element' ? 'same-element' : 'different-elements',
        winningCards: isPlayerWin ? this.playerWonCards : this.oppWonCards,
      })
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
    const fallbackIds = this.playerWonDealtCards.map((c) => c.dealtId).slice(-3)
    const ids = fallbackIds.length === 3 ? fallbackIds : [1, 2, 3]
    this.sendToFlash('czo', [CZO_OPCODE, DEFAULT_MATCH_COINS, PLAYER_SEAT, ...ids])
    void this.finalizeMatchEnd(PLAYER_SEAT, 'three-elements')
  }

  public forceLoss(): void {
    const fallbackIds = this.oppWonDealtCards.map((c) => c.dealtId).slice(-3)
    const ids = fallbackIds.length === 3 ? fallbackIds : [1, 2, 3]
    this.sendToFlash('czo', [CZO_OPCODE, DEFAULT_MATCH_COINS, OPP_SEAT, ...ids])
    void this.finalizeMatchEnd(OPP_SEAT, 'three-elements')
  }
}
