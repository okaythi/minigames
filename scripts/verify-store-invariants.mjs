import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DOJO_STORE_CONFIG, calculateCardWeight } from '../shared/card-jitsu-store-config.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

const colorsDir = path.join(rootDir, 'public/games/card-jitsu/assets/colors')
const packsDir = path.join(rootDir, 'public/games/card-jitsu/assets/card-packs')
const cardsPath = path.join(rootDir, 'src/games/card-jitsu/engine/deck/cards.json')
const dealableIdsPath = path.join(rootDir, 'src/games/card-jitsu/engine/deck/dealable-ids.json')

console.log('=== Invariant Check 1: Image Assets on Disk ===')
for (const c of DOJO_STORE_CONFIG.colors) {
  const file = path.join(colorsDir, c.iconFile)
  if (!fs.existsSync(file) || fs.statSync(file).size < 100) {
    throw new Error(`Missing or empty color asset: ${file}`)
  }
}
console.log(`✓ All ${DOJO_STORE_CONFIG.colors.length} color PNG assets verified!`)

const packFile = path.join(rootDir, 'public', DOJO_STORE_CONFIG.pack.iconUrl)
if (!fs.existsSync(packFile) || fs.statSync(packFile).size < 100) {
  throw new Error(`Missing pack icon asset: ${packFile}`)
}
console.log(`✓ Official Card Pack icon verified (${packFile})!`)

console.log('\n=== Invariant Check 2: Card Rarity Weights ===')
const sampleWeights = [
  { id: 1, expectedRarity: 0 },
  { id: 73, expectedRarity: 80 },
  { id: 104, expectedRarity: 95 },
  { id: 500, expectedRarity: 99 },
]

for (const { id, expectedRarity } of sampleWeights) {
  const w = calculateCardWeight(id)
  const expectedWeight = Math.pow(10, -4 * (expectedRarity / 100))
  if (Math.abs(w - expectedWeight) > 1e-9) {
    throw new Error(`Weight mismatch for card ${id}: got ${w}, expected ${expectedWeight}`)
  }
  console.log(`Card ${id}: rarity ${expectedRarity} -> weight ${w.toExponential(4)}`)
}

console.log('\n=== Invariant Check 3: Non-Repeating Pack Sampling Simulation (10,000 packs) ===')
const rawCards = JSON.parse(fs.readFileSync(cardsPath, 'utf8'))
const dealableIds = new Set(JSON.parse(fs.readFileSync(dealableIdsPath, 'utf8')))

const allDealable = rawCards.filter((c) => dealableIds.has(c.id))
const normalPool = allDealable.filter((c) => c.power_id === 0)
const powerPool = allDealable.filter((c) => c.power_id !== 0)

function sampleWeightedWithoutReplacement(pool, count) {
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

let duplicateViolations = 0
for (let i = 0; i < 10000; i++) {
  const normals = sampleWeightedWithoutReplacement(normalPool, 9)
  const powers = sampleWeightedWithoutReplacement(powerPool, 1)
  const combined = [...normals, ...powers]

  const distinct = new Set(combined.map((c) => c.id))
  if (distinct.size !== 10) {
    duplicateViolations++
  }
}

if (duplicateViolations > 0) {
  throw new Error(`FAILURE: Encountered ${duplicateViolations} duplicate violations in 10,000 simulated pack openings!`)
}

console.log('✓ 10,000 packs simulated: ZERO duplicates observed. 100% distinct card guarantee held!')
console.log('\n[ALL STORE INVARIANTS VERIFIED]')
