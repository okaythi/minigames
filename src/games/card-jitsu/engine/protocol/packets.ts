import type { CardData } from '../../types'

export const OPP_SEAT = 0 as const
export const PLAYER_SEAT = 1 as const
export const TIE_SEAT = -1 as const
export const MATCH_COINS = 0 as const

export type SeatId = typeof PLAYER_SEAT | typeof OPP_SEAT

export function getOpponentSeat(seat: SeatId): SeatId {
  return seat === PLAYER_SEAT ? OPP_SEAT : PLAYER_SEAT
}

export function formatCardWire(dealtId: number, card: CardData): string {
  return `${dealtId}|${card.id}|${card.element}|${card.value}|${card.color}|${card.powerId}`
}

export function buildGetGamePacket(): string {
  return `%xt%gz%-1%2%2%`
}

export function buildJoinGamePacket(nick: string, color: number, rank: number): string {
  return `%xt%jz%-1%${PLAYER_SEAT}%${nick}%${color}%${rank}%`
}

export function buildUpdateGamePacket(p0Record: string, p1Record: string): string {
  return `%xt%uz%-1%${p0Record}%${p1Record}%`
}

export function buildStartGamePacket(): string {
  return `%xt%sz%-1%`
}

export function buildDealPacket(seat: SeatId, cardStrings: readonly string[]): string {
  return `%xt%zm%-1%deal%${seat}%${cardStrings.join('%')}%`
}

export function buildPickPacket(seat: SeatId, dealtId: number): string {
  return `%xt%zm%-1%pick%${seat}%${dealtId}%`
}

export function buildPowerPacket(
  sender: SeatId,
  recipient: SeatId,
  powerId: number,
  discards: readonly number[] = [],
): string {
  const parts = ['power', sender, recipient, powerId, ...discards]
  return `%xt%zm%-1%${parts.join('%')}%`
}

export function buildJudgePacket(winnerSeat: number): string {
  return `%xt%zm%-1%judge%${winnerSeat}%`
}

export function buildGameOverPacket(
  winnerSeat: SeatId,
  winningDealtIds: readonly number[] = [],
): string {
  const idsSuffix = winningDealtIds.length > 0 ? `%${winningDealtIds.join('%')}` : ''
  return `%xt%czo%-1%${MATCH_COINS}%${winnerSeat}${idsSuffix}%`
}

export function buildAwardBeltPacket(rank: number): string {
  return `%xt%cza%-1%${rank}%`
}

export function buildStampInfoPacket(): string {
  return `%xt%cjsi%-1%`
}
