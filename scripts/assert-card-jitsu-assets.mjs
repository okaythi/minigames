import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

const cardsPath = path.join(rootDir, 'src/games/card-jitsu/engine/deck/cards.json')
const publicCardJitsu = path.join(rootDir, 'public/games/card-jitsu')
const battlesDir = path.join(publicCardJitsu, 'card/battles')
const iconsDir = path.join(publicCardJitsu, 'card/icons')

const reportOnly = process.argv.includes('--report-only')

if (!fs.existsSync(cardsPath)) {
  console.error(`cards.json not found at ${cardsPath}`)
  process.exit(1)
}

const cards = JSON.parse(fs.readFileSync(cardsPath, 'utf8'))

function getMd5(filePath) {
  if (!fs.existsSync(filePath)) return null
  const buf = fs.readFileSync(filePath)
  return crypto.createHash('md5').update(buf).digest('hex')
}

const ambientPath = path.join(battlesDir, 'ambient.swf')
const ambientHash = getMd5(ambientPath)

const missingIcons = []
const missingPowerBattles = []
const duplicateAmbientBattles = []
const missingFixedBattles = []

// Check fixed battle files
const fixedBattles = [
  'ambient.swf',
  'walk.swf',
  'tie.swf',
  'f_attack.swf',
  'f_react.swf',
  's_attack.swf',
  's_react.swf',
  'w_attack.swf',
  'w_react.swf'
]

for (const file of fixedBattles) {
  const filePath = path.join(battlesDir, file)
  if (!fs.existsSync(filePath)) {
    missingFixedBattles.push(file)
  } else if (file !== 'ambient.swf') {
    const hash = getMd5(filePath)
    if (ambientHash && hash === ambientHash) {
      duplicateAmbientBattles.push(file)
    }
  }
}

const dealableIds = []

// Check cards
for (const card of cards) {
  const iconPath = path.join(iconsDir, `${card.id}.swf`)
  const hasIcon = fs.existsSync(iconPath) && fs.statSync(iconPath).size > 0
  if (!hasIcon) {
    missingIcons.push(card.id)
  }

  let hasPower = true
  if (card.power_id > 0) {
    const attackPath = path.join(battlesDir, `pow_${card.id}_attack.swf`)
    const reactPath = path.join(battlesDir, `pow_${card.id}_react.swf`)

    const hasAttack =
      fs.existsSync(attackPath) &&
      fs.statSync(attackPath).size > 0 &&
      (!ambientHash || getMd5(attackPath) !== ambientHash)
    const hasReact =
      fs.existsSync(reactPath) &&
      fs.statSync(reactPath).size > 0 &&
      (!ambientHash || getMd5(reactPath) !== ambientHash)

    if (!hasAttack) {
      missingPowerBattles.push(`pow_${card.id}_attack.swf`)
    } else if (ambientHash && getMd5(attackPath) === ambientHash) {
      duplicateAmbientBattles.push(`pow_${card.id}_attack.swf`)
    }

    if (!hasReact) {
      missingPowerBattles.push(`pow_${card.id}_react.swf`)
    } else if (ambientHash && getMd5(reactPath) === ambientHash) {
      duplicateAmbientBattles.push(`pow_${card.id}_react.swf`)
    }

    if (!hasAttack || !hasReact) {
      hasPower = false
    }
  }

  if (hasIcon && hasPower) {
    dealableIds.push(card.id)
  }
}

const dealableOutPath = path.join(rootDir, 'src/games/card-jitsu/engine/deck/dealable-ids.json')
fs.writeFileSync(dealableOutPath, JSON.stringify(dealableIds, null, 2), 'utf8')
console.log(`Wrote ${dealableIds.length} dealable card IDs to ${dealableOutPath}`)

console.log('=== CARD-JITSU ASSET INTEGRITY REPORT ===')
console.log(`Total cards registered: ${cards.length}`)
console.log(`Dealable cards: ${dealableIds.length}`)
console.log(`Missing card icons (${missingIcons.length} / ${cards.length}):`)
if (missingIcons.length > 0) {
  console.log(`  IDs: ${missingIcons.slice(0, 10).join(', ')}${missingIcons.length > 10 ? ` ... (+${missingIcons.length - 10} more)` : ''}`)
}

console.log(`Missing fixed battles: ${missingFixedBattles.length}`)
if (missingFixedBattles.length > 0) {
  console.log(`  Files: ${missingFixedBattles.join(', ')}`)
}

console.log(`Corrupted / Ambient duplicate battles: ${duplicateAmbientBattles.length}`)
if (duplicateAmbientBattles.length > 0) {
  console.log(`  Files: ${duplicateAmbientBattles.join(', ')}`)
}

console.log(`Missing power animations: ${missingPowerBattles.length}`)
if (missingPowerBattles.length > 0) {
  console.log(`  Files: ${missingPowerBattles.slice(0, 10).join(', ')}${missingPowerBattles.length > 10 ? ` ... (+${missingPowerBattles.length - 10} more)` : ''}`)
}

const hasErrors =
  missingIcons.length > 0 ||
  missingFixedBattles.length > 0 ||
  duplicateAmbientBattles.length > 0 ||
  missingPowerBattles.length > 0

if (hasErrors) {
  if (reportOnly) {
    console.log('\n[REPORT ONLY] Asset gaps reported. Build continuing.')
    process.exit(0)
  } else {
    console.error('\n[ASSET ERROR] Card-Jitsu media assets incomplete or corrupted.')
    process.exit(1)
  }
} else {
  console.log('\n[PASS] All Card-Jitsu assets verified.')
  process.exit(0)
}

