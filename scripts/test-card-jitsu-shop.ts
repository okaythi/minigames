import assert from 'node:assert/strict'
import {
  TOTAL_DEALABLE_CARDS,
  TOTAL_NORMAL_CARDS,
  TOTAL_POWER_CARDS,
  validateCardInventory,
  getCardInventorySize,
  hasAllCards,
  isDeckPurchaseLocked,
  isShopDeckPurchaseSectionVisible,
  isNormalCard,
  isPowerCard,
  calculateCardWeight,
  DOJO_STORE_CONFIG,
} from '../shared/card-jitsu-store-config'
import rawCards from '../src/games/card-jitsu/engine/deck/cards.json'
import dealableIds from '../src/games/card-jitsu/engine/deck/dealable-ids.json'

console.log('[TEST] Starting Card-Jitsu Shop Roll & Collection Completion Verification...')

interface RawCard {
  readonly id: number
  readonly name: string
  readonly set_id: number
  readonly power_id: number
  readonly element: string
  readonly color: string
  readonly value: number
  readonly description: string
}

const DEALABLE_SET = new Set<number>(dealableIds as readonly number[])
const ALL_CARDS: readonly RawCard[] = (rawCards as readonly RawCard[]).filter((c) =>
  DEALABLE_SET.has(c.id),
)
const NORMAL_POOL: readonly RawCard[] = ALL_CARDS.filter((c) => isNormalCard(c.power_id))
const POWER_POOL: readonly RawCard[] = ALL_CARDS.filter((c) => isPowerCard(c.power_id))

// 1. Card Classification: card == normal_card XOR card == power_card
assert.equal(ALL_CARDS.length, TOTAL_DEALABLE_CARDS, 'Total dealable cards must be 509')
assert.equal(ALL_CARDS.length, 509, 'Total dealable cards must be exactly 509')
assert.equal(NORMAL_POOL.length, TOTAL_NORMAL_CARDS, 'Normal pool must be 405')
assert.equal(NORMAL_POOL.length, 405, 'Normal pool must be exactly 405')
assert.equal(POWER_POOL.length, TOTAL_POWER_CARDS, 'Power pool must be 104')
assert.equal(POWER_POOL.length, 104, 'Power pool must be exactly 104')
assert.equal(NORMAL_POOL.length + POWER_POOL.length, 509, 'Normal + Power must sum to 509')

for (const card of ALL_CARDS) {
  const isNorm = isNormalCard(card.power_id)
  const isPow = isPowerCard(card.power_id)
  assert.equal(Boolean(Number(isNorm) ^ Number(isPow)), true, `Card ${card.id} must be normal XOR power`)
}
console.log('✓ Card classification XOR property verified (405 normal + 104 power = 509 total)')

// 2. Single Source of Truth & Inventory Invariant (amount > 1 THEN error)
const validInventory = [
  { cardId: 1, quantity: 1, memberQuantity: 0 },
  { cardId: 6, quantity: 1, memberQuantity: 0 },
  { cardId: 73, quantity: 1, memberQuantity: 0 },
]
assert.doesNotThrow(() => validateCardInventory(validInventory), 'Valid inventory must pass')
assert.equal(getCardInventorySize(validInventory), 3, 'Inventory size must be 3')

assert.throws(
  () => validateCardInventory([{ cardId: 1, quantity: 2, memberQuantity: 0 }]),
  /Catastrophic/i,
  'quantity > 1 must throw catastrophic error',
)

assert.throws(
  () => validateCardInventory([{ cardId: 1, quantity: 1, memberQuantity: 1 }]),
  /Catastrophic/i,
  'quantity + memberQuantity > 1 must throw catastrophic error',
)

assert.throws(
  () => validateCardInventory([
    { cardId: 1, quantity: 1, memberQuantity: 0 },
    { cardId: 1, quantity: 1, memberQuantity: 0 },
  ]),
  /Duplicate/i,
  'duplicate card rows must throw error',
)
console.log('✓ Single source of truth validator (IF card.amount > 1 THEN error) verified')

// 3. Pre-sampling draw & Surplus Replacement
function sampleWeightedWithoutReplacement<T extends { readonly id: number }>(
  pool: readonly T[],
  count: number,
): T[] {
  if (count <= 0 || pool.length === 0) return []
  const k = Math.min(count, pool.length)

  const scored = pool.map((item) => {
    const weight = calculateCardWeight(item.id)
    const u = Math.max(1e-15, Math.random())
    const key = weight > 0 ? Math.pow(u, 1 / weight) : -Infinity
    return { item, key }
  })

  scored.sort((a, b) => b.key - a.key)
  return scored.slice(0, k).map((s) => s.item)
}

function simulateDraw(userOwnedCardIds: Set<number>) {
  const unownedNormals = NORMAL_POOL.filter((c) => !userOwnedCardIds.has(c.id))
  const unownedPowers = POWER_POOL.filter((c) => !userOwnedCardIds.has(c.id))

  const hasAllNormalCards = unownedNormals.length === 0
  const hasAllPowerCards = unownedPowers.length === 0

  let targetNormals: number = DOJO_STORE_CONFIG.packRules.normalCardsCount
  let targetPowers: number = DOJO_STORE_CONFIG.packRules.powerCardsCount

  if (hasAllNormalCards) {
    targetPowers = Math.min(DOJO_STORE_CONFIG.packRules.totalCards, unownedPowers.length)
    targetNormals = 0
  } else if (hasAllPowerCards) {
    targetNormals = Math.min(DOJO_STORE_CONFIG.packRules.totalCards, unownedNormals.length)
    targetPowers = 0
  } else {
    const actualNormals = Math.min(targetNormals, unownedNormals.length)
    const normalDeficit = targetNormals - actualNormals
    targetNormals = actualNormals
    targetPowers = Math.min(targetPowers + normalDeficit, unownedPowers.length)
  }

  const drawnNormals = sampleWeightedWithoutReplacement(unownedNormals, targetNormals)
  const drawnPowers = sampleWeightedWithoutReplacement(unownedPowers, targetPowers)

  return [...drawnNormals, ...drawnPowers]
}

// 3a. Standard Draw (plenty unowned)
{
  const starter = new Set<number>([1, 6, 9, 14, 17, 20, 22, 23, 26, 73, 81, 89])
  const drawn = simulateDraw(starter)
  assert.equal(drawn.length, 10, 'Standard draw must deliver 10 cards')
  assert.equal(new Set(drawn.map((c) => c.id)).size, 10, 'All 10 cards must be unique')
  for (const c of drawn) {
    assert.equal(starter.has(c.id), false, 'Cannot draw already owned card')
  }
  assert.equal(drawn.filter((c) => c.power_id === 0).length, 9, 'Must draw 9 normals')
  assert.equal(drawn.filter((c) => c.power_id !== 0).length, 1, 'Must draw 1 power')
  console.log('✓ Standard draw verified (9 normal + 1 power, 0 repeats)')
}

// 3b. has_all_normal_cards -> surplus normal slots converted to power cards
{
  const owned = new Set<number>([
    ...NORMAL_POOL.map((c) => c.id),
    ...POWER_POOL.slice(0, 10).map((c) => c.id),
  ])
  const drawn = simulateDraw(owned)
  assert.equal(drawn.length, 10, 'Must deliver 10 cards')
  assert.equal(new Set(drawn.map((c) => c.id)).size, 10, 'All 10 cards must be unique')
  for (const c of drawn) {
    assert.equal(owned.has(c.id), false, 'Must be unowned')
    assert.equal(isPowerCard(c.power_id), true, 'All cards must be power cards')
  }
  console.log('✓ has_all_normal_cards surplus replacement verified (all 10 slots -> power cards)')
}

// 3c. has_all_power_cards -> surplus power slot converted to normal cards
{
  const owned = new Set<number>([
    ...POWER_POOL.map((c) => c.id),
    ...NORMAL_POOL.slice(0, 50).map((c) => c.id),
  ])
  const drawn = simulateDraw(owned)
  assert.equal(drawn.length, 10, 'Must deliver 10 cards')
  assert.equal(new Set(drawn.map((c) => c.id)).size, 10, 'All 10 cards must be unique')
  for (const c of drawn) {
    assert.equal(owned.has(c.id), false, 'Must be unowned')
    assert.equal(isNormalCard(c.power_id), true, 'All cards must be normal cards')
  }
  console.log('✓ has_all_power_cards surplus replacement verified (power slot -> normal card)')
}

// 3d. Deficit in normal cards (< 9 normal unowned) -> converts deficit to power cards
{
  const ownedNormals = NORMAL_POOL.slice(0, 402).map((c) => c.id) // 3 unowned normals left
  const owned = new Set<number>(ownedNormals)
  const drawn = simulateDraw(owned)
  assert.equal(drawn.length, 10, 'Must deliver 10 cards')
  assert.equal(new Set(drawn.map((c) => c.id)).size, 10, 'All 10 cards must be unique')
  assert.equal(drawn.filter((c) => c.power_id === 0).length, 3, 'Must deliver 3 remaining normals')
  assert.equal(drawn.filter((c) => c.power_id !== 0).length, 7, 'Must deliver 1 + 6 deficit powers')
  console.log('✓ Deficit in normal cards verified (remaining normals delivered, rest converted to powers)')
}

// 3e. Low total cards remaining (< 10 unowned cards total)
{
  const owned = new Set<number>([
    ...NORMAL_POOL.map((c) => c.id),
    ...POWER_POOL.slice(0, 100).map((c) => c.id), // 4 unowned powers left in game
  ])
  const drawn = simulateDraw(owned)
  assert.equal(drawn.length, 4, 'Must deliver exactly 4 remaining cards')
  assert.equal(new Set(drawn.map((c) => c.id)).size, 4, 'All 4 cards must be unique')
  for (const c of drawn) {
    assert.equal(owned.has(c.id), false, 'Must be unowned')
  }
  console.log('✓ Sub-10 card pack delivery verified (delivered 4 remaining cards)')
}

// 4. Collection Completion & Hard Lock
assert.equal(hasAllCards(508), false, '508 cards is not complete')
assert.equal(isDeckPurchaseLocked(508), false, '508 cards is not locked')
assert.equal(isShopDeckPurchaseSectionVisible(508), true, '508 cards section is visible')

assert.equal(hasAllCards(509), true, '509 cards is complete')
assert.equal(isDeckPurchaseLocked(509), true, '509 cards is locked')
assert.equal(isShopDeckPurchaseSectionVisible(509), false, '509 cards section is hidden')

for (let size = 0; size <= 509; size++) {
  const complete = hasAllCards(size)
  const locked = isDeckPurchaseLocked(size)
  const visible = isShopDeckPurchaseSectionVisible(size)
  if (size === 509) {
    assert.equal(complete, true)
    assert.equal(locked, true)
    assert.equal(visible, false)
  } else {
    assert.equal(complete, false)
    assert.equal(locked, false)
    assert.equal(visible, true)
  }
}
console.log('✓ Collection completion 509 IFF invariants & hard lock verified')

console.log('ALL TESTS PASSED SUCCESSFULLY! 🎉')
