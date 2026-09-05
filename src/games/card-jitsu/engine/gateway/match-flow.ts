import type {
  CardData,
  ClashResult,
  MatchEndDecision,
  MatchEndResult,
  OnMatchEndCallback,
} from '../../types'
import {
  type ActivePowerState,
  AffectsOwnPlayer,
  OnPlayed,
  resolveRoundClash,
  getWinningCombo,
  hasCardsToPlay,
  advancePowers,
  discardOpponentCard,
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
  public powers: ReadonlyMap<number, ActivePowerState> = new Map<number, ActivePowerState>()
  public discards: number[] = []
  public lastClash: ClashResult | null = null
  public matchWinner: 'player' | 'sensei' | null = null
  public matchResult: MatchEndResult | null = null
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
    this.powers = new Map<number, ActivePowerState>()
    this.discards = []
    this.lastClash = null
    this.matchWinner = null
    this.matchResult = null
    this.senseiCardPlayed = false
    this.matchEnded = false
    this.matchEndPromise = Promise.resolve()
  }

  public async executeClash(
    pId: number,
    pCard: CardData,
    oId: number,
    oCard: CardData,
    playerHand: readonly DealtCard[],
    oppHand: readonly DealtCard[],
  ): Promise<boolean> {
    // This must happen before the winner is chosen: powers 16–18 transform
    // the current pair of elements, while saved Power 1/2/3 effects modify
    // this pair's values. The printed CardData remains untouched for banks.
    const resolvedRound = resolveRoundClash(pCard, oCard, this.powers, PLAYER_SEAT, OPP_SEAT)
    const clashWinner = resolvedRound.winner
    const winnerSeatId: SeatId | typeof TIE_SEAT =
      clashWinner === 1 ? PLAYER_SEAT : clashWinner === -1 ? OPP_SEAT : TIE_SEAT
    this.discards = []
    let winningCard: CardData | null = null

    if (winnerSeatId === PLAYER_SEAT) {
      winningCard = pCard
      this.playerWonCards.push(pCard)
      this.playerWonDealtCards.push({ dealtId: pId, card: pCard })
      if (pCard.powerId) {
        discardOpponentCard(pCard.powerId, this.oppWonCards, this.discards, this.oppWonDealtCards)
      }
    } else if (winnerSeatId === OPP_SEAT) {
      winningCard = oCard
      this.oppWonCards.push(oCard)
      this.oppWonDealtCards.push({ dealtId: oId, card: oCard })
      if (oCard.powerId) {
        discardOpponentCard(oCard.powerId, this.playerWonCards, this.discards, this.playerWonDealtCards)
      }
    }

    if (pCard.powerId && OnPlayed.has(pCard.powerId)) {
      this.options.onSendRaw(buildPowerPacket(PLAYER_SEAT, OPP_SEAT, pCard.powerId))
    }
    if (oCard.powerId && OnPlayed.has(oCard.powerId)) {
      this.options.onSendRaw(buildPowerPacket(OPP_SEAT, PLAYER_SEAT, oCard.powerId))
    }

    if (winnerSeatId !== TIE_SEAT && winningCard?.powerId && !OnPlayed.has(winningCard.powerId)) {
      const affectsOwn = AffectsOwnPlayer.has(winningCard.powerId)
      const sender = winnerSeatId
      const recipient = affectsOwn ? winnerSeatId : getOpponentSeat(winnerSeatId)
      this.options.onSendRaw(buildPowerPacket(sender, recipient, winningCard.powerId, this.discards))
      this.discards = []
    }

    // Authoritative power state mutation solely through advancePowers
    const scoredCard =
      winnerSeatId === PLAYER_SEAT
        ? { seat: PLAYER_SEAT, card: pCard }
        : winnerSeatId === OPP_SEAT
          ? { seat: OPP_SEAT, card: oCard }
          : null

    this.powers = advancePowers(
      this.powers,
      [
        { seat: PLAYER_SEAT, card: pCard },
        { seat: OPP_SEAT, card: oCard },
      ],
      scoredCard,
    )

    if (pCard.id === 256 || oCard.id === 256) this.senseiCardPlayed = true

    this.lastClash = {
      playerCard: pCard,
      senseiCard: oCard,
      winner: winnerSeatId === PLAYER_SEAT ? 'player' : winnerSeatId === OPP_SEAT ? 'sensei' : 'tie',
      reason:
        resolvedRound.firstCard.element !== resolvedRound.secondCard.element
          ? 'element'
          : resolvedRound.firstCard.value === resolvedRound.secondCard.value
            ? 'tie'
            : 'value',
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
    this.matchResult = matchResult

    let decision: MatchEndDecision = {}
    if (this.options.onMatchEnd) {
      try {
        const matchEndTask = Promise.resolve(this.options.onMatchEnd(matchResult))
        const timeoutPromise = new Promise<MatchEndDecision>((resolve) => {
          setTimeout(() => resolve({}), 2_000)
        })
        // Never make the end screen wait forever for a product integration.
        // The callback may still finish later (and update its own persistence
        // UI), but gameplay is allowed to close after this bounded wait.
        const decisionTask = Promise.race([matchEndTask, timeoutPromise])
        this.matchEndPromise = decisionTask.then(() => {}, () => {})
        decision = await decisionTask
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

