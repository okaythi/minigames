import type {
  CardData,
  CardJitsuPhase,
  CardStore,
  MatchStats,
  NinjaBelt,
} from '../../types'
import { DEALABLE_IDS, DefaultCardStore } from '../deck/cards'
import { executeDealRound } from '../deal/deal-strategy'
import { type BotContext, type BotPolicy, createBotPolicy } from '../ai/bot-policy'
import {
  PLAYER_SEAT,
  OPP_SEAT,
  TIE_SEAT,
  MATCH_COINS,
  getOpponentSeat,
  buildGetGamePacket,
  buildJoinGamePacket,
  buildUpdateGamePacket,
  buildStartGamePacket,
  buildDealPacket,
  buildPickPacket,
  buildStampInfoPacket,
} from '../protocol/packets'
import { BELT_TO_RANK, RANK_TO_BELT, getBeltRank } from '../progression'
import { selectOpponent, type BotOpponent } from '../opponents/roster'
import { MatchFlow, type DealtCard } from './match-flow'
import type { GameMode, SessionConfig } from './session-types'

export {
  PLAYER_SEAT,
  OPP_SEAT,
  TIE_SEAT,
  MATCH_COINS,
  getOpponentSeat,
  BELT_TO_RANK,
  RANK_TO_BELT,
  type DealtCard,
  type GameMode,
  type SessionConfig,
}

export class CardJitsuSession {
  private readonly store: CardStore
  private readonly matchFlow: MatchFlow
  private phase: CardJitsuPhase = 'dialogue'
  private nextDealtId = 1
  private senseiColors: string[] = []
  private botOpponent: BotOpponent | null = null
  private botNick = 'Ninja Student'
  private botColor = 2
  private botPolicy: BotPolicy | null = null

  private playerDealtMap = new Map<number, CardData>()
  private oppDealtMap = new Map<number, CardData>()
  private senseiMoveMap = new Map<number, number>()
  private playerHistory: CardData[] = []
  private playerSelectedCard: CardData | null = null
  private oppSelectedCard: CardData | null = null

  private config: SessionConfig
  private flashBridge: ((msg: string) => void) | null = null
  private listeners: Set<(stats: MatchStats, phase: CardJitsuPhase) => void> = new Set()

  constructor(config: SessionConfig) {
    this.config = config
    this.store = config.cardStore ?? new DefaultCardStore()

    const dropped = this.store.getOwned().filter((i) => !DEALABLE_IDS.has(i.cardId)).map((i) => i.cardId)
    if (dropped.length > 0) console.warn('[Card-Jitsu] Dropping owned cards outside dealable pool:', dropped)

    if (this.isSenseiMode()) {
      this.botNick = 'Sensei'
      this.botColor = 14
      this.botOpponent = null
      this.botPolicy = null
    } else {
      this.botOpponent = selectOpponent(
        this.getPlayerBeltRank(),
        [],
        config.eligibleOpponents,
        config.overrideOpponent,
      )
      this.botNick = this.botOpponent.name
      this.botColor = this.botOpponent.colorId
      this.botPolicy = config.opponentPolicy ?? createBotPolicy(this.botOpponent.rank)
    }

    this.matchFlow = new MatchFlow({
      isSensei: this.isSenseiMode(),
      onSendRaw: (packet) => this.sendRaw(packet),
      onMatchEnd: config.onMatchEnd,
      onClashDone: (result, won) => config.onClashDone?.(result, { won }),
      onGameOver: (winner) => {
        this.phase = 'game-over'
        config.onGameOver?.(winner)
        this.notify()
      },
    })
  }

  public setBridge(bridge: (msg: string) => void): void {
    this.flashBridge = bridge
  }

  public subscribe(listener: (stats: MatchStats, phase: CardJitsuPhase) => void): () => void {
    this.listeners.add(listener)
    listener(this.getStats(), this.phase)
    return () => this.listeners.delete(listener)
  }

  public isSenseiMode(): boolean { return this.config.mode === 'sensei' || this.config.mode === 'MODE_SEN' }
  public getPhase(): CardJitsuPhase { return this.phase }
  public getPlayerNick(): string { return this.config.playerNick ?? 'Ninja' }
  public getPlayerColor(): number { return this.config.playerColor ?? 6 }
  public getPlayerBeltRank(): number { return getBeltRank(this.config.playerBelt) }
  public getMode(): GameMode { return this.config.mode }

  public getStats(): MatchStats {
    return {
      round: this.matchFlow.round,
      playerWonCards: [...this.matchFlow.playerWonCards],
      senseiWonCards: [...this.matchFlow.oppWonCards],
      playerHand: Array.from(this.playerDealtMap.values()),
      senseiHand: Array.from(this.oppDealtMap.values()),
      playerSelectedCard: this.playerSelectedCard,
      senseiSelectedCard: this.oppSelectedCard,
      lastClash: this.matchFlow.lastClash,
      matchWinner: this.matchFlow.matchWinner,
    }
  }

  public setPlayerBelt(belt: NinjaBelt): void {
    this.config = { ...this.config, playerBelt: belt }
    this.botPolicy = this.config.opponentPolicy ?? createBotPolicy(Math.min(this.getPlayerBeltRank() + 1, 9))
    this.notify()
  }

  public startMatch(mode?: GameMode): void {
    if (mode) this.config = { ...this.config, mode }
    this.nextDealtId = 1
    this.playerHistory = []
    this.playerSelectedCard = null
    this.oppSelectedCard = null
    this.playerDealtMap.clear()
    this.oppDealtMap.clear()
    this.senseiMoveMap.clear()
    this.senseiColors = []

    if (this.isSenseiMode()) {
      this.botNick = 'Sensei'
      this.botColor = 14
      this.botOpponent = null
      this.botPolicy = null
    } else {
      this.botOpponent = selectOpponent(
        this.getPlayerBeltRank(),
        [],
        this.config.eligibleOpponents,
        this.config.overrideOpponent,
      )
      this.botNick = this.botOpponent.name
      this.botColor = this.botOpponent.colorId
      this.botPolicy = this.config.opponentPolicy ?? createBotPolicy(this.botOpponent.rank)
    }
    this.matchFlow.reset()
    this.phase = 'choosing'
    this.notify()
  }

  public handleFlashPacket(
    _ext: string,
    action: string,
    args: readonly unknown[],
    _type?: string,
    _roomId?: number,
  ): void {
    if (action === 'gz') {
      this.startMatch()
      this.sendRaw(buildGetGamePacket())
      this.sendRaw(buildJoinGamePacket(this.getPlayerNick(), this.getPlayerColor(), this.getPlayerBeltRank()))
    } else if (action === 'uz') {
      const p0 = this.isSenseiMode()
        ? `${OPP_SEAT}|Sensei|14|10`
        : `${OPP_SEAT}|${this.botNick}|${this.botColor}|${this.botOpponent?.rank ?? Math.min(this.getPlayerBeltRank() + 1, 9)}`
      const p1 = `${PLAYER_SEAT}|${this.getPlayerNick()}|${this.getPlayerColor()}|${this.getPlayerBeltRank()}`
      this.sendRaw(buildUpdateGamePacket(p0, p1))
      this.sendRaw(buildStartGamePacket())
    } else if (action === 'zm') {
      const sub = String(args[0] ?? '')
      if (sub === 'deal') this.handleDeal()
      else if (sub === 'pick') this.handlePickCard(Number(args[1] ?? 0))
    } else if (action === 'lz') {
      this.sendRaw(buildStampInfoPacket())
      this.phase = 'dialogue'
      this.notify()
    }
  }

  private handleDeal(): void {
    const isSensei = this.isSenseiMode()
    const canBeat = this.getPlayerBeltRank() >= 9
    const batch = executeDealRound(
      isSensei,
      canBeat,
      this.nextDealtId,
      this.store,
      Array.from(this.playerDealtMap.values()),
      this.oppDealtMap.size,
      this.senseiColors,
      this.botOpponent?.deckCards,
    )
    if (batch.playerDealt.length === 0) return

    this.nextDealtId = batch.nextDealtId
    for (const item of batch.playerDealt) this.playerDealtMap.set(item.dealtId, item.card)
    for (const item of batch.oppDealt) this.oppDealtMap.set(item.dealtId, item.card)
    for (const [pId, sId] of batch.senseiPairs) this.senseiMoveMap.set(pId, sId)

    this.sendRaw(buildDealPacket(PLAYER_SEAT, batch.playerDealt.map((i) => i.wire)))
    this.sendRaw(buildDealPacket(OPP_SEAT, batch.oppDealt.map((i) => i.wire)))
    this.phase = 'choosing'
    this.notify()
  }

  private handlePickCard(playerDealtId: number): void {
    if (this.matchFlow.matchEnded) return
    const pCard = this.playerDealtMap.get(playerDealtId)
    if (!pCard) return

    this.playerDealtMap.delete(playerDealtId)
    this.playerSelectedCard = pCard
    this.playerHistory.push(pCard)

    if (this.isSenseiMode()) {
      const oppDealtId = this.senseiMoveMap.get(playerDealtId)
      if (oppDealtId === undefined) return
      const oppCard = this.oppDealtMap.get(oppDealtId)
      if (!oppCard) return

      this.oppDealtMap.delete(oppDealtId)
      this.senseiMoveMap.delete(playerDealtId)
      this.oppSelectedCard = oppCard

      this.sendRaw(buildPickPacket(PLAYER_SEAT, playerDealtId))
      this.sendRaw(buildPickPacket(OPP_SEAT, oppDealtId))
      this.phase = 'clashing'
      this.notify()
      void this.triggerClash(playerDealtId, pCard, oppDealtId, oppCard)
    } else {
      this.sendRaw(buildPickPacket(PLAYER_SEAT, playerDealtId))
      this.phase = 'choosing'
      this.notify()
      this.scheduleBotTurn(playerDealtId, pCard)
    }
  }

  private scheduleBotTurn(playerDealtId: number, playerCard: CardData): void {
    const oppEntries = Array.from(this.oppDealtMap.entries())
    const playerEntries = Array.from(this.playerDealtMap.entries())
    const botContext: BotContext = {
      hand: oppEntries.map(([dealtId, card]) => ({ dealtId, card })),
      myBank: [...this.matchFlow.oppWonCards],
      oppBank: [...this.matchFlow.playerWonCards],
      oppHand: playerEntries.map(([dealtId, card]) => ({ dealtId, card })),
      oppHistory: [...this.playerHistory],
      activePowers: this.matchFlow.powers,
    }
    const botDealtId = this.botPolicy?.pick(botContext) ?? oppEntries[0]![0]
    const oppCard = this.oppDealtMap.get(botDealtId)
    if (!oppCard) return
    this.oppDealtMap.delete(botDealtId)
    this.oppSelectedCard = oppCard

    setTimeout(() => {
      if (this.matchFlow.matchEnded) return
      this.sendRaw(buildPickPacket(OPP_SEAT, botDealtId))
      this.phase = 'clashing'
      this.notify()
      void this.triggerClash(playerDealtId, playerCard, botDealtId, oppCard)
    }, Math.floor(Math.random() * 800) + 300)
  }

  private async triggerClash(pId: number, pCard: CardData, oId: number, oCard: CardData): Promise<void> {
    const pHand = Array.from(this.playerDealtMap.entries()).map(([dealtId, card]) => ({ dealtId, card }))
    const oHand = Array.from(this.oppDealtMap.entries()).map(([dealtId, card]) => ({ dealtId, card }))
    const ended = await this.matchFlow.executeClash(pId, pCard, oId, oCard, pHand, oHand)
    this.phase = ended ? 'game-over' : 'choosing'
    this.notify()
  }

  private sendRaw(msg: string): void {
    this.flashBridge?.(msg)
  }

  private notify(): void {
    const stats = this.getStats()
    this.config.onStateChange?.(stats, this.phase)
    for (const listener of this.listeners) listener(stats, this.phase)
  }
}
