import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/
const errors = []
const warnings = []

console.log('🎮 [Nixlabs] Running Game Plugin & Contract Validator...\n')

// 1. Read & Validate Game Registry
const registryPath = path.join(rootDir, 'shared/game-registry.json')
if (!fs.existsSync(registryPath)) {
  console.error(`❌ Registry file not found at ${registryPath}`)
  process.exit(1)
}

const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'))
const seenSlugs = new Set()

for (const entry of registry) {
  if (!entry.slug || !SLUG_PATTERN.test(entry.slug)) {
    errors.push(`Invalid slug format: "${entry.slug}". Must match ${SLUG_PATTERN}`)
  }

  if (seenSlugs.has(entry.slug)) {
    errors.push(`Duplicate slug in GAME_REGISTRY: "${entry.slug}"`)
  }
  seenSlugs.add(entry.slug)

  if (entry.source?.type === 'local') {
    const relPath = entry.source.path.replace(/^\.\//, '')
    const gameDir = path.resolve(rootDir, 'src', 'games', relPath)

    if (!fs.existsSync(gameDir)) {
      errors.push(`Game "${entry.slug}": Local directory does not exist at ${gameDir}`)
      continue
    }

    // Check entry point
    const hasIndex =
      fs.existsSync(path.join(gameDir, 'index.tsx')) ||
      fs.existsSync(path.join(gameDir, 'index.ts'))
    if (!hasIndex) {
      errors.push(`Game "${entry.slug}": Missing entry point (index.tsx or index.ts) in ${gameDir}`)
    }

    // Check manifest
    const hasManifest =
      fs.existsSync(path.join(gameDir, 'manifest.ts')) ||
      fs.existsSync(path.join(gameDir, 'manifest.tsx'))
    if (!hasManifest) {
      errors.push(`Game "${entry.slug}": Missing manifest (manifest.ts) in ${gameDir}`)
    }

    // Check cover art
    const hasCover =
      fs.existsSync(path.join(gameDir, 'cover.jpg')) ||
      fs.existsSync(path.join(gameDir, 'cover.png'))
    if (!hasCover) {
      warnings.push(`Game "${entry.slug}": Cover art (cover.jpg/png) not found in ${gameDir}`)
    }
  } else if (entry.source?.type === 'package') {
    if (!entry.source.name || typeof entry.source.name !== 'string') {
      errors.push(`Game "${entry.slug}": Missing or invalid package name`)
    }
  }
}

// 2. Read & Validate Canonical Achievements
const achievementDefsPath = path.join(rootDir, 'shared/achievement-defs.ts')
if (fs.existsSync(achievementDefsPath)) {
  const content = fs.readFileSync(achievementDefsPath, 'utf8')
  // Regex match achievement def objects
  const idMatches = [...content.matchAll(/id:\s*['"]([^'"]+)['"]/g)].map((m) => m[1])
  const pillarMatches = [...content.matchAll(/pillar:\s*['"]([^'"]+)['"]/g)].map((m) => m[1])

  const seenIds = new Set()
  for (const id of idMatches) {
    if (seenIds.has(id)) {
      errors.push(`Duplicate achievement ID in definitions: "${id}"`)
    }
    seenIds.add(id)
  }

  const registeredPillars = new Set(['platform', ...registry.map((g) => g.slug)])
  for (const pillar of pillarMatches) {
    if (!registeredPillars.has(pillar)) {
      warnings.push(
        `Achievement references pillar "${pillar}", which is not a registered game slug or "platform".`
      )
    }
  }

  console.log(`✅ Verified ${seenIds.size} canonical achievement definitions.`)
}

// Print Diagnostics
for (const w of warnings) {
  console.warn(`⚠️  WARNING: ${w}`)
}

if (errors.length > 0) {
  console.error(`\n❌ Validation failed with ${errors.length} error(s):`)
  for (const err of errors) {
    console.error(`  - ${err}`)
  }
  process.exit(1)
}

console.log(`✅ Successfully validated ${registry.length} registered games:`)
for (const entry of registry) {
  console.log(`   • ${entry.slug} [${entry.enabled ? 'ENABLED' : 'DISABLED'}] (${entry.source.type})`)
}
console.log('\n🚀 All game contracts and integrity checks passed!\n')
