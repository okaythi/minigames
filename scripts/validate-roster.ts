import { validateRoster, ROSTER_ENTRIES, selectOpponent, expandRanges } from '../src/games/card-jitsu/engine/opponents/roster'
import { BELT_RANKS, RANK_TO_BELT } from '../src/games/card-jitsu/engine/progression'
import { sample } from '../src/games/card-jitsu/engine/deck/cards'

console.log('===============================================================')
console.log('      CARD-JITSU OPPONENT ROSTER INTEGRITY VALIDATION          ')
console.log('===============================================================')

const result = validateRoster()
console.log(`Roster Entries Analyzed: ${ROSTER_ENTRIES.length}`)
console.log(`Power/Normal ID Classification Valid: ${result.valid ? 'YES' : 'NO (DISCREPANCIES FOUND)'}`)

const powerInNormal = result.discrepancies.filter((d) => d.type === 'power-in-normal')
const normalInPower = result.discrepancies.filter((d) => d.type === 'normal-in-power')
const missingMedia = result.discrepancies.filter((d) => d.type === 'missing-media')

console.log(`\nDiscrepancy Breakdown:`)
console.log(`- Power cards in normal range: ${powerInNormal.length}`)
console.log(`- Normal cards in power range: ${normalInPower.length}`)
console.log(`- Cards missing complete media: ${missingMedia.length}`)

if (normalInPower.length > 0) {
  console.log('\n[CRITICAL DISCREPANCY] Normal cards listed in Power ranges:')
  const seen = new Set<number>()
  for (const d of normalInPower) {
    if (!seen.has(d.cardId)) {
      seen.add(d.cardId)
      console.log(`  Bot: ${d.bot} | Card ID: ${d.cardId} -> ${d.details}`)
    }
  }
}

if (powerInNormal.length > 0) {
  console.log('\n[CRITICAL DISCREPANCY] Power cards listed in Normal ranges:')
  const seen = new Set<number>()
  for (const d of powerInNormal) {
    if (!seen.has(d.cardId)) {
      seen.add(d.cardId)
      console.log(`  Bot: ${d.bot} | Card ID: ${d.cardId} -> ${d.details}`)
    }
  }
}

console.log('\n===============================================================')
console.log('      DEAL VERIFICATION PER TIER (TIERS 1 TO 9)                ')
console.log('===============================================================')

for (let playerRank = 1; playerRank <= 8; playerRank++) {
  const bot = selectOpponent(playerRank)
  const allowedNormalIds = new Set(expandRanges(ROSTER_ENTRIES.find((r) => r.name === bot.name)!.deck.normal))
  const allowedPowerIds = new Set(expandRanges(ROSTER_ENTRIES.find((r) => r.name === bot.name)!.deck.power))
  const allowedAll = new Set([...allowedNormalIds, ...allowedPowerIds])

  // Simulate 5 dealt cards
  const dealt = sample(bot.deckCards, Math.min(5, bot.deckCards.length))
  const allInsideRange = dealt.every((c) => allowedAll.has(c.id))

  console.log(`Tier ${bot.rank} (${bot.belt.toUpperCase()} BELT) Opponent: ${bot.name}`)
  console.log(`  Total Deck Available (with media): ${bot.deckCards.length}`)
  console.log(`  Sample Hand (5 cards): [${dealt.map((c) => `${c.id}:${c.element}${c.value}`).join(', ')}]`)
  console.log(`  All Dealt Cards Within Configured Ranges: ${allInsideRange ? 'YES (PASS)' : 'NO (FAIL)'}`)
}

console.log('\nValidation script execution completed.')
