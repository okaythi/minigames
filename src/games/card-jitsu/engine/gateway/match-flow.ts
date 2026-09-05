import type {
  CardData,
  ClashResult,
  MatchEndDecision,
  MatchEndResult,
  OnMatchEndCallback,
} from '../../types'
import {
  type ActiveCardState,
  type ActivePowerCard,
  AffectsOwnPlayer,
  OnPlayed,
  adjustCardValues,
  getWinningCombo,
  getWinnerSeatId,
  hasCardsToPlay,
  onPlayedEffects,
  onScoredEffects,
} from '../rules'
import {
  PLAYER_SEAT,
  OPP_SEAT,
  TIE_SEAT,
  type SeatId,
  getOpponentSeat,
  buildPowerPacket,
  buildJudgePacket,
  buildGameOverPacket,
  buildAwardBeltPacket,
} from '../protocol/packets'

export interface DealtCard {
  readonly dealtId: number
  readonly card: CardData
}

export interface MatchFlowOptions {
  readonly isSensei: boolean
  readonly onSendRaw: (packet: string) => void
  readonly onMatchEnd?: OnMatchEndCallback
  readonly onClashDone?: (result: ClashResult, won: boolean) => void
  readonly onGameOver?: (winner: 'player' | 'sensei') => void
}

export class MatchFlow {
  public round = 1
  public playerWonCards: CardData[] = []
  public oppWonCards: CardData[] = []
  public playerWonDealtCards: DealtCard[] = []
  public oppWonDealtCards: DealtCard[] = []
  public powers = new Map<number, ActivePowerCard>()
  public discards: number[] = []
  public lastClash: ClashResult | null = null
  public matchWinner: 'player' | 'sensei' | null = null
  public senseiCardPlayed = false
  public matchEnded = false
  public matchEndPromise: Promise<void> = Promise.resolve()

  constructor(private readonly options: MatchFlowOptions) {}

  public reset(): void {
    this.round = 1
    this.playerWonCards = []
    this.oppWonCards = []
    this.playerWonDealtCards = []
    this.oppWonDealtCards = []
    this.powers.clear()
    this.discards = []
    this.lastClash = null
    this.matchWinner = null
    this.senseiCardPlayed = false
    this.matchEnded = false
  }

  public async executeClash(
    pId: number,
    pCard: CardData,
    oId: number,
    oCard: CardData,
    playerHand: readonly DealtCard[],
    oppHand: readonly DealtCard[],
  ): Promise<boolean> {
    const first: ActiveCardState = {
      element: pCard.element,
      value: pCard.value,
      card: pCard,
      player: PLAYER_SEAT,
      opponent: OPP_SEAT,
    }
    const second: ActiveCardState = {
      element: oCard.element,
      value: oCard.value,
      card: oCard,
      player: OPP_SEAT,
      opponent: PLAYER_SEAT,
    }

    adjustCardValues(first, second, this.powers)
    this.powers.clear()
    onPlayedEffects(first, second, this.powers)

    if (pCard.powerId && OnPlayed.has(pCard.powerId)) {
      this.options.onSendRaw(buildPowerPacket(PLAYER_SEAT, OPP_SEAT, pCard.powerId))
    }
    if (oCard.powerId && OnPlayed.has(oCard.powerId)) {
      this.options.onSendRaw(buildPowerPacket(OPP_SEAT, PLAYER_SEAT, oCard.powerId))
    }

    const winnerSeatId = getWinnerSeatId(first, second) as SeatId | typeof TIE_SEAT
    this.discards = []
    let winningCard: CardData | null = null

    if (winnerSeatId === PLAYER_SEAT) {
      winningCard = pCard
      this.playerWonCards.push(pCard)
      this.playerWonDealtCards.push({ dealtId: pId, card: pCard })
      onScoredEffects(winnerSeatId, first, second, this.powers, this.oppWonCards, this.discards, this.oppWonDealtCards)
    } else if (winnerSeatId === OPP_SEAT) {
      winningCard = oCard
      this.oppWonCards.push(oCard)
      this.oppWonDealtCards.push({ dealtId: oId, card: oCard })
      onScoredEffects(winnerSeatId, first, second, this.powers, this.playerWonCards, this.discards, this.playerWonDealtCards)
    }

    if (winnerSeatId !== TIE_SEAT && winningCard?.powerId && !OnPlayed.has(winningCard.powerId)) {
      const affectsOwn = AffectsOwnPlayer.has(winningCard.powerId)
      const sender = winnerSeatId
      const recipient = affectsOwn ? winnerSeatId : getOpponentSeat(winnerSeatId)
      this.options.onSendRaw(buildPowerPacket(sender, recipient, winningCard.powerId, this.discards))
      this.discards = []
    }

    if (pCard.id === 256 || oCard.id === 256) this.senseiCardPlayed = true

    this.lastClash = {
      playerCard: pCard,
      senseiCard: oCard,
      winner: winnerSeatId === PLAYER_SEAT ? 'player' : winnerSeatId === OPP_SEAT ? 'sensei' : 'tie',
      reason: first.element !== second.element ? 'element' : first.value === second.value ? 'tie' : 'value',
      ...(winningCard?.powerId && winningCard.powerId > 0 ? { powerTriggered: winningCard.powerId } : {}),
      message: winnerSeatId === PLAYER_SEAT ? `${pCard.name ?? 'Player'} wins!` : winnerSeatId === OPP_SEAT ? `${oCard.name ?? 'Opponent'} wins!` : 'Clash tie!',
    }

    if (winnerSeatId !== TIE_SEAT) {
      const wonDealt = winnerSeatId === PLAYER_SEAT ? this.playerWonDealtCards : this.oppWonDealtCards
      const winCombo = getWinningCombo(wonDealt)
      if (winCombo !== null) {
        this.options.onSendRaw(buildGameOverPacket(winnerSeatId, winCombo.winningDealtIds))
        await this.finalizeMatchEnd(winnerSeatId, winCombo.winMethod)
        return true
      }
    }

    if (!hasCardsToPlay(PLAYER_SEAT, playerHand, this.powers)) {
      this.options.onSendRaw(buildGameOverPacket(OPP_SEAT))
      await this.finalizeMatchEnd(OPP_SEAT, 'no-cards')
      return true
    }
    if (!hasCardsToPlay(OPP_SEAT, oppHand, this.powers)) {
      this.options.onSendRaw(buildGameOverPacket(PLAYER_SEAT))
      await this.finalizeMatchEnd(PLAYER_SEAT, 'no-cards')
      return true
    }

    this.options.onSendRaw(buildJudgePacket(winnerSeatId))
    this.round++
    if (this.lastClash) {
      this.options.onClashDone?.(this.lastClash, false)
    }
    return false
  }

  public async finalizeMatchEnd(
    winnerSeatId: SeatId,
    winMethod: 'same-element' | 'three-elements' | 'no-cards' | 'forfeit',
  ): Promise<void> {
    this.matchEnded = true
    this.matchWinner = winnerSeatId === PLAYER_SEAT ? 'player' : 'sensei'

    const isPlayerWin = winnerSeatId === PLAYER_SEAT
    const winnerBank = isPlayerWin ? this.playerWonCards : this.oppWonCards
    const loserBank = isPlayerWin ? this.oppWonCards : this.playerWonCards

    const matchResult: MatchEndResult = {
      winner: isPlayerWin ? 'player' : 'opponent',
      mode: this.options.isSensei ? 'sensei' : 'belts',
      rounds: this.round,
      playerBank: [...this.playerWonCards],
      opponentBank: [...this.oppWonCards],
      winMethod,
      flawless: loserBank.length === 0,
      fullDojo: winnerBank.length >= 9,
      senseiCardPlayed: this.senseiCardPlayed,
    }

    let decision: MatchEndDecision = {}
    if (this.options.onMatchEnd) {
      try {
        const matchEndTask = Promise.resolve(this.options.onMatchEnd(matchResult))
        this.matchEndPromise = matchEndTask.then(() => {})
        const timeoutPromise = new Promise<MatchEndDecision>((resolve) => setTimeout(() => resolve({}), 2000))
        decision = await Promise.race([matchEndTask, timeoutPromise])
      } catch (err) {
        console.warn('[Card-Jitsu] onMatchEnd error:', err)
      }
    }

    if (decision?.awardRank !== undefined) {
      this.options.onSendRaw(buildAwardBeltPacket(decision.awardRank))
    }

    this.options.onSendRaw(buildJudgePacket(winnerSeatId))
    this.options.onGameOver?.(this.matchWinner)
    if (this.lastClash) {
      this.options.onClashDone?.(this.lastClash, true)
    }
  }
}

