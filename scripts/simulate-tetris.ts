import { SevenBagRandomizer } from '../../game-tetris/src/engine/randomizer'
import {
  canPlacePiece,
  clearRows,
  createEmptyMatrix,
  findFullRows,
  isPerfectClear,
  lockPiece,
} from '../../game-tetris/src/engine/matrix'
import { getKickOffsets } from '../../game-tetris/src/engine/tetrominoes'
import type { ActivePiece, TetrominoType } from '../../game-tetris/src/engine/types'

const checks: { readonly name: string; readonly ok: boolean }[] = []
const check = (name: string, ok: boolean): void => {
  checks.push({ name, ok })
}
const line = (label: string, value: string): void => {
  console.log(`${label.padEnd(42)} ${value}`)
}

console.log('\n🎮 [Tetris Simulation] Running Headless Invariant Verification...\n')

// 1. 7-Bag Randomizer Uniformity
const randomizer = new SevenBagRandomizer()
const counts: Record<TetrominoType, number> = {
  I: 0,
  O: 0,
  T: 0,
  S: 0,
  Z: 0,
  J: 0,
  L: 0,
}

let bagOrderCorrect = true
for (let b = 0; b < 1000; b++) {
  const currentBag = new Set<TetrominoType>()
  for (let p = 0; p < 7; p++) {
    const piece = randomizer.next()
    counts[piece]++
    currentBag.add(piece)
  }
  if (currentBag.size !== 7) {
    bagOrderCorrect = false
  }
}

const allUniform = Object.values(counts).every((c) => c === 1000)
check('7-Bag: Each piece generated exactly 1,000 times in 1,000 bags', allUniform)
check('7-Bag: Every 7-piece window contains all 7 unique pieces', bagOrderCorrect)

// 2. SRS Wall Kicks
const kicks01 = getKickOffsets('T', 0, 1)
check('SRS: T-piece 0->1 rotation provides 5 kick test offsets', kicks01.length === 5)

const iKicks = getKickOffsets('I', 0, 1)
check('SRS: I-piece 0->1 rotation provides 5 kick test offsets', iKicks.length === 5)

// 3. Matrix Collision Detection
const matrix = createEmptyMatrix()
check('Matrix: Initial matrix starts completely empty', isPerfectClear(matrix))

const validPlacement = canPlacePiece(matrix, 'T', 0, 3, 5)
check('Matrix: Valid placement within bounds succeeds', validPlacement)

const outOfBoundsLeft = canPlacePiece(matrix, 'T', 0, -1, 5)
check('Matrix: Negative X placement rejected', !outOfBoundsLeft)

const outOfBoundsRight = canPlacePiece(matrix, 'T', 0, 9, 5)
check('Matrix: Out of bounds right placement rejected', !outOfBoundsRight)

const outOfBoundsBottom = canPlacePiece(matrix, 'T', 0, 3, 21)
check('Matrix: Out of bounds bottom placement rejected', !outOfBoundsBottom)

// 4. Lock Piece and Row Clearing
const testPiece: ActivePiece = { type: 'I', rotation: 0, x: 0, y: 20 }
const locked = lockPiece(matrix, testPiece)
check('Matrix: Piece locks correctly into matrix', !isPerfectClear(locked))

// Create a board with row 21 completely filled
const fullRowMatrix = createEmptyMatrix().map((row, r) =>
  r === 21 ? new Array(10).fill('cyan' as const) : [...row],
)

const detectedFullRows = findFullRows(fullRowMatrix)
check('Matrix: Full row detection identifies filled lines', detectedFullRows.length > 0)

const cleared = clearRows(fullRowMatrix, detectedFullRows)
check('Matrix: Cleared rows are removed from the board', findFullRows(cleared).length === 0)

// Summary
console.log('='.repeat(50))
for (const c of checks) {
  line(c.name, c.ok ? 'PASS' : 'FAIL')
}
console.log('='.repeat(50))

const allPassed = checks.every((c) => c.ok)
if (allPassed) {
  console.log(`\n✅ All ${checks.length} Tetris invariants passed! Headless simulation OK.\n`)
} else {
  console.error(`\n❌ Some invariants failed!\n`)
  process.exit(1)
}
