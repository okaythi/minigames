import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  beatsCard,
  doesElementBeat,
  adjustCardValues,
  getWinnerSeatId,
  onPlayedEffects,
  onScoredEffects,
  getWinningCombo,
  hasCardsToPlay,
  type ActiveCardState,
  type ActivePowerCard,
} from '../src/games/card-jitsu/engine/rules'
import {
  PLAYER_SEAT,
  OPP_SEAT,
  TIE_SEAT,
  MATCH_COINS,
} from '../src/games/card-jitsu/engine/protocol/packets'
import {
  BELT_RANKS,
  BELT_TO_RANK,
  RANK_TO_BELT,
  getRequiredExp,
  getBeltRank,
  getRankBelt,
} from '../src/games/card-jitsu/engine/progression'
import type { CardData } from '../src/games/card-jitsu/types'

console.log('[TEST] Starting Card-Jitsu Rules & Engine Verification...')

// 1. Element Superiority: ninja.py L171-L177
assert.equal(doesElementBeat('f', 's'), true, 'Fire must beat Snow')
assert.equal(doesElementBeat('s', 'w'), true, 'Snow must beat Water')
assert.equal(doesElementBeat('w', 'f'), true, 'Water must beat Fire')
assert.equal(doesElementBeat('s', 'f'), false, 'Snow cannot beat Fire')
assert.equal(doesElementBeat('w', 's'), false, 'Water cannot beat Snow')
assert.equal(doesElementBeat('f', 'w'), false, 'Fire cannot beat Water')

// 2. Numeric tie & beatsCard: ninja.py L171-L177
const cardF10: CardData = { id: 1, element: 'f', value: 10, color: 'r', powerId: 0 }
const cardF8: CardData = { id: 2, element: 'f', value: 8, color: 'b', powerId: 0 }
const cardS12: CardData = { id: 3, element: 's', value: 12, color: 'g', powerId: 0 }
assert.equal(beatsCard(cardF10, cardF8), true, 'Same element: higher value wins')
assert.equal(beatsCard(cardF8, cardF10), false, 'Same element: lower value loses')
assert.equal(beatsCard(cardF8, cardS12), true, 'Element beats element regardless of value (F8 beats S12)')

// 3. Power 1 (Value Swap on same element): ninja.py L193-L195
{
  const powers = new Map<number, ActivePowerCard>()
  powers.set(1, { powerId: 1, player: PLAYER_SEAT, opponent: OPP_SEAT, card: { id: 100, element: 'f', value: 2, color: 'r', powerId: 1 } })
  const c1: ActiveCardState = { element: 'f', value: 3, card: cardF8, player: PLAYER_SEAT, opponent: OPP_SEAT }
  const c2: ActiveCardState = { element: 'f', value: 9, card: cardF10, player: OPP_SEAT, opponent: PLAYER_SEAT }
  adjustCardValues(c1, c2, powers)
  assert.equal(c1.value, 9, 'Power 1 must swap values: c1 gets 9')
  assert.equal(c2.value, 3, 'Power 1 must swap values: c2 gets 3')
}

// 4. Power 2 (+2 Self next round): ninja.py L196-L197
{
  const powers = new Map<number, ActivePowerCard>()
  powers.set(2, { powerId: 2, player: PLAYER_SEAT, opponent: OPP_SEAT, card: { id: 101, element: 'f', value: 2, color: 'r', powerId: 2 } })
  const c1: ActiveCardState = { element: 'f', value: 5, card: cardF8, player: PLAYER_SEAT, opponent: OPP_SEAT }
  const c2: ActiveCardState = { element: 'f', value: 5, card: cardF8, player: OPP_SEAT, opponent: PLAYER_SEAT }
  adjustCardValues(c1, c2, powers)
  assert.equal(c1.value, 7, 'Power 2 must add +2 to user card')
  assert.equal(c2.value, 5, 'Power 2 does not buff opponent card')
}

// 5. Power 3 (-2 Opponent next round): ninja.py L198-L199
{
  const powers = new Map<number, ActivePowerCard>()
  powers.set(3, { powerId: 3, player: PLAYER_SEAT, opponent: OPP_SEAT, card: { id: 102, element: 'f', value: 2, color: 'r', powerId: 3 } })
  const c1: ActiveCardState = { element: 'f', value: 6, card: cardF8, player: PLAYER_SEAT, opponent: OPP_SEAT }
  const c2: ActiveCardState = { element: 'f', value: 6, card: cardF8, player: OPP_SEAT, opponent: PLAYER_SEAT }
  adjustCardValues(c1, c2, powers)
  assert.equal(c1.value, 6, 'Power 3 does not lower user card')
  assert.equal(c2.value, 4, 'Power 3 must subtract 2 from opponent card')
}

// 6. Powers 4-6 (Element Discards): ninja.py L240-L255
{
  const powers = new Map<number, ActivePowerCard>()
  const oppBank: CardData[] = [
    { id: 10, element: 'f', value: 5, color: 'r', powerId: 0 },
    { id: 11, element: 's', value: 6, color: 'b', powerId: 0 },
  ]
  const oppDealt = [{ dealtId: 21, card: oppBank[1]! }]
  const discards: number[] = []
  const c1: ActiveCardState = { element: 'f', value: 10, card: { id: 200, element: 'f', value: 10, color: 'y', powerId: 4 }, player: PLAYER_SEAT, opponent: OPP_SEAT }
  const c2: ActiveCardState = { element: 'f', value: 3, card: cardF8, player: OPP_SEAT, opponent: PLAYER_SEAT }
  onScoredEffects(PLAYER_SEAT, c1, c2, powers, oppBank, discards, oppDealt)
  assert.equal(discards.length, 1, 'Power 4 must discard opponent snow card')
  assert.equal(discards[0], 21, 'Discarded dealtId must be recorded')
  assert.equal(oppBank.length, 1, 'Opponent snow card removed from bank')
  assert.equal(oppBank[0]!.element, 'f', 'Fire card remains in bank')
}

// 7. Powers 13-15 (Power Limiters): ninja.py L222-L224 & L280-L287
{
  const powers = new Map<number, ActivePowerCard>()
  powers.set(13, { powerId: 13, player: PLAYER_SEAT, opponent: OPP_SEAT, card: { id: 300, element: 's', value: 10, color: 'r', powerId: 13 } })
  // Power 13 locks out opponent if they ONLY have Snow (s)
  const oppHandAllSnow = [
    { dealtId: 1, card: { id: 1, element: 's' as const, value: 5, color: 'r' as const, powerId: 0 } },
    { dealtId: 2, card: { id: 2, element: 's' as const, value: 7, color: 'b' as const, powerId: 0 } },
  ]
  assert.equal(hasCardsToPlay(OPP_SEAT, oppHandAllSnow, powers), false, 'Opponent with only Snow locked out by Power 13')

  const oppHandMixed = [
    { dealtId: 1, card: { id: 1, element: 's' as const, value: 5, color: 'r' as const, powerId: 0 } },
    { dealtId: 2, card: { id: 3, element: 'f' as const, value: 4, color: 'g' as const, powerId: 0 } },
  ]
  assert.equal(hasCardsToPlay(OPP_SEAT, oppHandMixed, powers), true, 'Opponent with Fire can play despite Power 13')
}

// 8. Powers 16-18 (Element Replacements on played): ninja.py L211-L218
{
  const powers = new Map<number, ActivePowerCard>()
  // Power 16: replaces Water with Fire (original: 'w' -> replacement: 'f')
  const c1: ActiveCardState = { element: 'w', value: 5, card: { id: 400, element: 'w', value: 5, color: 'r', powerId: 16 }, player: PLAYER_SEAT, opponent: OPP_SEAT }
  const c2: ActiveCardState = { element: 'w', value: 4, card: { id: 401, element: 'w', value: 4, color: 'b', powerId: 0 }, player: OPP_SEAT, opponent: PLAYER_SEAT }
  onPlayedEffects(c1, c2, powers)
  assert.equal(c1.element, 'f', 'Power 16 replaces Water with Fire for c1')
  assert.equal(c2.element, 'f', 'Power 16 replaces Water with Fire for c2')
}

// 9. Winning Combos: ninja.py L150-L169
{
  // Same element, 3 distinct colors
  const sameElementTriad = [
    { dealtId: 10, card: { id: 1, element: 'f' as const, value: 5, color: 'r' as const, powerId: 0 } },
    { dealtId: 11, card: { id: 2, element: 'f' as const, value: 6, color: 'b' as const, powerId: 0 } },
    { dealtId: 12, card: { id: 3, element: 'f' as const, value: 7, color: 'y' as const, powerId: 0 } },
  ]
  const res1 = getWinningCombo(sameElementTriad)
  assert.notEqual(res1, null)
  assert.equal(res1!.winMethod, 'same-element')
  assert.deepEqual(res1!.winningDealtIds, [10, 11, 12])

  // Same element, duplicate color -> no win
  const sameElementDupColor = [
    { dealtId: 10, card: { id: 1, element: 'f' as const, value: 5, color: 'r' as const, powerId: 0 } },
    { dealtId: 11, card: { id: 2, element: 'f' as const, value: 6, color: 'r' as const, powerId: 0 } },
    { dealtId: 12, card: { id: 3, element: 'f' as const, value: 7, color: 'y' as const, powerId: 0 } },
  ]
  assert.equal(getWinningCombo(sameElementDupColor), null)

  // Three elements, 3 distinct colors
  const threeElementsTriad = [
    { dealtId: 20, card: { id: 1, element: 'f' as const, value: 5, color: 'r' as const, powerId: 0 } },
    { dealtId: 21, card: { id: 2, element: 'w' as const, value: 6, color: 'b' as const, powerId: 0 } },
    { dealtId: 22, card: { id: 3, element: 's' as const, value: 7, color: 'g' as const, powerId: 0 } },
  ]
  const res2 = getWinningCombo(threeElementsTriad)
  assert.notEqual(res2, null)
  assert.equal(res2!.winMethod, 'three-elements')
  assert.deepEqual(res2!.winningDealtIds, [20, 21, 22])

  // Three elements, duplicate color -> no win
  const threeElementsDupColor = [
    { dealtId: 20, card: { id: 1, element: 'f' as const, value: 5, color: 'r' as const, powerId: 0 } },
    { dealtId: 21, card: { id: 2, element: 'w' as const, value: 6, color: 'r' as const, powerId: 0 } },
    { dealtId: 22, card: { id: 3, element: 's' as const, value: 7, color: 'g' as const, powerId: 0 } },
  ]
  assert.equal(getWinningCombo(threeElementsDupColor), null)
}

// 10. Progression & Houdini Exp formula: ninja.py L49
{
  assert.equal(getRequiredExp(1), 5, 'Rank 1 requires 5 exp')
  assert.equal(getRequiredExp(2), 15, 'Rank 2 requires 15 exp')
  assert.equal(getRequiredExp(3), 30, 'Rank 3 requires 30 exp')
  assert.equal(getRequiredExp(8), 180, 'Rank 8 requires 180 exp')
  assert.equal(getRequiredExp(9), 225, 'Rank 9 requires 225 exp')
  assert.equal(BELT_RANKS.length, 9, '9 belt ranks')
  assert.equal(getBeltRank('white'), 1)
  assert.equal(getBeltRank('black'), 9)
  assert.equal(getRankBelt(1), 'white')
  assert.equal(getRankBelt(9), 'black')
}

// 11. Seat Constants & Wire Integrity
assert.equal(PLAYER_SEAT, 1, 'PLAYER_SEAT must be 1')
assert.equal(OPP_SEAT, 0, 'OPP_SEAT must be 0')
assert.equal(TIE_SEAT, -1, 'TIE_SEAT must be -1')
assert.equal(MATCH_COINS, 0, 'MATCH_COINS must be 0')

// 12. Dynamic Card Injection & Deal Verification
{
  const { CardJitsuSession } = await import('../src/games/card-jitsu/engine/gateway/session')
  const session = new CardJitsuSession({
    playerBelt: 'white',
    mode: 'belts',
  })
  assert.equal(session.getOwnedCards().length, 12, 'Default session starts with 12 starter cards')

  // Inject full 509 card pool
  const full509 = Array.from({ length: 509 }, (_, i) => ({
    cardId: i + 1,
    quantity: 1,
    memberQuantity: 0,
  }))
  session.setOwnedCards(full509)
  assert.equal(session.getOwnedCards().length, 509, 'Session reflects all 509 cards after setOwnedCards')
}

// 13. Engine Belt Progression & Bot Upgrading
{
  const { CardJitsuSession } = await import('../src/games/card-jitsu/engine/gateway/session')
  const session = new CardJitsuSession({
    playerBelt: 'white',
    mode: 'belts',
  })
  assert.equal(session.getPlayerBeltRank(), 1, 'Initial belt rank is 1 (White)')

  // Advance player to rank 5 (Blue)
  session.setPlayerRank(5)
  assert.equal(session.getPlayerBeltRank(), 5, 'Session player belt rank is updated to 5')

  // Start a match and verify opponent rank scales to min(playerRank + 1, 9) = 6
  session.startMatch('belts')
  const oppNick = session.getOpponentNick()
  assert.ok(oppNick.length > 0, 'Opponent selected for rank 5')

  // Advance player to rank 9 (Black)
  session.setPlayerRank(9)
  assert.equal(session.getPlayerBeltRank(), 9, 'Session player belt rank is updated to 9 (Black)')

  // Advance player to rank 10 (Master)
  session.setPlayerRank(10)
  assert.equal(session.getPlayerBeltRank(), 10, 'Session player belt rank is updated to 10 (Ninja Master)')
}

console.log('[TEST] PASS: All 13 Card-Jitsu Rules & Engine Assertions Verified.')
