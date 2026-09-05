import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import zlib from 'node:zlib'
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

function getSha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex')
}

/**
 * Validates a SWF binary file:
 * - Checks header magic ('FWS', 'CWS', 'ZWS')
 * - Rejects HTML bodies saved with .swf extension
 * - Verifies uncompressed length matches header file length
 * - Parses SWF tags and extracts exported symbol names (Tag 56: ExportAssets)
 */
function validateSwf(filePath) {
  if (!fs.existsSync(filePath)) {
    return { ok: false, error: 'FILE_MISSING' }
  }
  const stat = fs.statSync(filePath)
  if (stat.size < 8) {
    return { ok: false, error: 'FILE_TRUNCATED_OR_EMPTY', size: stat.size }
  }
  const buf = fs.readFileSync(filePath)
  const preview = buf.subarray(0, Math.min(buf.length, 128)).toString('utf8').trim().toLowerCase()
  if (
    preview.startsWith('<!doctype') ||
    preview.startsWith('<html') ||
    preview.startsWith('<?xml') ||
    preview.includes('<html')
  ) {
    return { ok: false, error: 'HTML_BODY_SAVED_AS_SWF', size: stat.size }
  }

  const magic = buf.subarray(0, 3).toString('ascii')
  if (magic !== 'FWS' && magic !== 'CWS' && magic !== 'ZWS') {
    return { ok: false, error: `INVALID_SWF_MAGIC_${magic}`, size: stat.size }
  }

  const headerUncompressedLength = buf.readUInt32LE(4)
  let uncompressedBody
  if (magic === 'FWS') {
    uncompressedBody = buf.subarray(8)
    if (buf.length !== headerUncompressedLength) {
      return {
        ok: false,
        error: `FWS_LENGTH_MISMATCH (header ${headerUncompressedLength}, file ${buf.length})`,
      }
    }
  } else if (magic === 'CWS') {
    try {
      uncompressedBody = zlib.inflateSync(buf.subarray(8))
    } catch (err) {
      return { ok: false, error: `ZLIB_DECOMPRESS_FAILED (${err.message})` }
    }
    const actualUncompressedLength = uncompressedBody.length + 8
    if (actualUncompressedLength !== headerUncompressedLength) {
      return {
        ok: false,
        error: `CWS_LENGTH_MISMATCH (header ${headerUncompressedLength}, decompressed ${actualUncompressedLength})`,
      }
    }
  } else {
    return { ok: false, error: 'ZWS_LZMA_NOT_SUPPORTED' }
  }

  // Parse SWF tags to find exported symbols
  const exportedSymbols = []
  if (uncompressedBody.length >= 1) {
    const nBits = uncompressedBody[0] >> 3
    const rectBits = 5 + nBits * 4
    const rectBytes = Math.ceil(rectBits / 8)
    let pos = rectBytes + 4 // skip RECT + FrameRate (2) + FrameCount (2)

    while (pos < uncompressedBody.length) {
      if (pos + 2 > uncompressedBody.length) break
      const tagHeader = uncompressedBody.readUInt16LE(pos)
      pos += 2
      const tagCode = tagHeader >> 6
      let tagLen = tagHeader & 0x3f
      if (tagLen === 0x3f) {
        if (pos + 4 > uncompressedBody.length) break
        tagLen = uncompressedBody.readUInt32LE(pos)
        pos += 4
      }
      if (tagCode === 0) break // End tag
      if (tagCode === 56) {
        // Tag 56 = ExportAssets
        let p = pos
        if (p + 2 <= uncompressedBody.length) {
          const count = uncompressedBody.readUInt16LE(p)
          p += 2
          for (let i = 0; i < count && p < pos + tagLen; i++) {
            p += 2 // skip character tag
            const end = uncompressedBody.indexOf(0, p)
            if (end !== -1 && end <= pos + tagLen) {
              exportedSymbols.push(uncompressedBody.subarray(p, end).toString('latin1'))
              p = end + 1
            } else {
              break
            }
          }
        }
      }
      pos += tagLen
    }
  }

  return {
    ok: true,
    sha256: getSha256(buf),
    magic,
    size: buf.length,
    uncompressedLength: headerUncompressedLength,
    exportedSymbols,
  }
}

const ambientPath = path.join(battlesDir, 'ambient.swf')
const ambientValidation = validateSwf(ambientPath)
const ambientSha256 = ambientValidation.ok ? ambientValidation.sha256 : null

const missingIcons = []
const invalidIcons = []
const missingPowerBattles = []
const invalidPowerBattles = []
const duplicateAmbientBattles = []
const missingFixedBattles = []
const invalidFixedBattles = []

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
  'w_react.swf',
]

for (const file of fixedBattles) {
  const filePath = path.join(battlesDir, file)
  const res = validateSwf(filePath)
  if (!res.ok) {
    if (res.error === 'FILE_MISSING') {
      missingFixedBattles.push(file)
    } else {
      invalidFixedBattles.push(`${file} (${res.error})`)
    }
  } else if (file !== 'ambient.swf' && ambientSha256 && res.sha256 === ambientSha256) {
    duplicateAmbientBattles.push(file)
  }
}

const dealableIds = []

// Validate each card
for (const card of cards) {
  const iconPath = path.join(iconsDir, `${card.id}.swf`)
  const iconRes = validateSwf(iconPath)
  let hasValidIcon = false
  if (!iconRes.ok) {
    if (iconRes.error === 'FILE_MISSING') {
      missingIcons.push(card.id)
    } else {
      invalidIcons.push(`${card.id}.swf (${iconRes.error})`)
    }
  } else {
    hasValidIcon = true
  }

  let hasValidPower = true
  if (card.power_id > 0) {
    const attackPath = path.join(battlesDir, `pow_${card.id}_attack.swf`)
    const reactPath = path.join(battlesDir, `pow_${card.id}_react.swf`)

    const attackRes = validateSwf(attackPath)
    const reactRes = validateSwf(reactPath)

    // Check attack SWF
    if (!attackRes.ok) {
      if (attackRes.error === 'FILE_MISSING') {
        missingPowerBattles.push(`pow_${card.id}_attack.swf`)
      } else {
        invalidPowerBattles.push(`pow_${card.id}_attack.swf (${attackRes.error})`)
      }
      hasValidPower = false
    } else if (ambientSha256 && attackRes.sha256 === ambientSha256) {
      duplicateAmbientBattles.push(`pow_${card.id}_attack.swf`)
      hasValidPower = false
    } else {
      // Check ExportAssets contains 'attack'
      const hasAttackSymbol = attackRes.exportedSymbols.some((sym) =>
        sym.toLowerCase().includes('attack'),
      )
      if (!hasAttackSymbol) {
        invalidPowerBattles.push(
          `pow_${card.id}_attack.swf (ExportAssets missing 'attack': [${attackRes.exportedSymbols.join(', ')}])`,
        )
        hasValidPower = false
      }
    }

    // Check react SWF
    if (!reactRes.ok) {
      if (reactRes.error === 'FILE_MISSING') {
        missingPowerBattles.push(`pow_${card.id}_react.swf`)
      } else {
        invalidPowerBattles.push(`pow_${card.id}_react.swf (${reactRes.error})`)
      }
      hasValidPower = false
    } else if (ambientSha256 && reactRes.sha256 === ambientSha256) {
      duplicateAmbientBattles.push(`pow_${card.id}_react.swf`)
      hasValidPower = false
    } else {
      // Check ExportAssets contains 'react'
      const hasReactSymbol = reactRes.exportedSymbols.some((sym) =>
        sym.toLowerCase().includes('react'),
      )
      if (!hasReactSymbol) {
        invalidPowerBattles.push(
          `pow_${card.id}_react.swf (ExportAssets missing 'react': [${reactRes.exportedSymbols.join(', ')}])`,
        )
        hasValidPower = false
      }
    }
  }

  if (hasValidIcon && hasValidPower) {
    dealableIds.push(card.id)
  }
}

const dealableOutPath = path.join(rootDir, 'src/games/card-jitsu/engine/deck/dealable-ids.json')
fs.writeFileSync(dealableOutPath, JSON.stringify(dealableIds, null, 2), 'utf8')
console.log(`Wrote ${dealableIds.length} dealable card IDs to ${dealableOutPath}`)

console.log('=== CARD-JITSU ASSET INTEGRITY REPORT ===')
console.log(`Total cards registered in cards.json: ${cards.length}`)
console.log(`Dealable cards passing all SWF integrity checks: ${dealableIds.length}`)
console.log(`Missing card icons: ${missingIcons.length}`)
if (missingIcons.length > 0) {
  console.log(`  IDs: ${missingIcons.slice(0, 10).join(', ')}${missingIcons.length > 10 ? ` ... (+${missingIcons.length - 10} more)` : ''}`)
}
if (invalidIcons.length > 0) {
  console.log(`Invalid / Corrupt card icons: ${invalidIcons.length}`)
  console.log(`  Files: ${invalidIcons.slice(0, 5).join(', ')}`)
}

console.log(`Missing fixed battles: ${missingFixedBattles.length}`)
if (missingFixedBattles.length > 0) {
  console.log(`  Files: ${missingFixedBattles.join(', ')}`)
}
if (invalidFixedBattles.length > 0) {
  console.log(`Invalid fixed battles: ${invalidFixedBattles.length}`)
  console.log(`  Files: ${invalidFixedBattles.join(', ')}`)
}

console.log(`Placeholder duplicate battles (matching ambient.swf SHA-256): ${duplicateAmbientBattles.length}`)
if (duplicateAmbientBattles.length > 0) {
  console.log(`  Files: ${duplicateAmbientBattles.slice(0, 10).join(', ')}`)
}

console.log(`Missing power animations: ${missingPowerBattles.length}`)
if (missingPowerBattles.length > 0) {
  console.log(`  Files: ${missingPowerBattles.slice(0, 10).join(', ')}${missingPowerBattles.length > 10 ? ` ... (+${missingPowerBattles.length - 10} more)` : ''}`)
}
if (invalidPowerBattles.length > 0) {
  console.log(`Invalid power animations (tag mismatch/corrupt): ${invalidPowerBattles.length}`)
  console.log(`  Files: ${invalidPowerBattles.slice(0, 5).join(', ')}`)
}

const hasErrors =
  missingIcons.length > 0 ||
  invalidIcons.length > 0 ||
  missingFixedBattles.length > 0 ||
  invalidFixedBattles.length > 0 ||
  duplicateAmbientBattles.length > 0 ||
  missingPowerBattles.length > 0 ||
  invalidPowerBattles.length > 0

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

