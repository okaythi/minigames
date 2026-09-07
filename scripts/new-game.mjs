/**
 * Scaffolds a new standalone minigame repository conforming to the Nixlabs Game Plugin contract.
 *
 * Usage:
 *   node scripts/new-game.mjs <slug> [destination_path]
 *   npm run game:new <slug>
 */

import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

const slug = process.argv[2]?.trim().toLowerCase()
if (!slug || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(slug)) {
  console.error('❌ Error: Please specify a valid kebab-case game slug.')
  console.error('   Example: npm run game:new space-invaders')
  process.exit(1)
}

const titleCase = slug
  .split('-')
  .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
  .join(' ')

const targetDir = process.argv[3]
  ? path.resolve(process.cwd(), process.argv[3])
  : path.resolve(rootDir, '..', `game-${slug}`)

if (fs.existsSync(targetDir)) {
  console.error(`❌ Target directory already exists: ${targetDir}`)
  process.exit(1)
}

console.log(`🚀 Scaffolding new game repository "${titleCase}" (${slug}) at:`)
console.log(`   ${targetDir}\n`)

fs.mkdirSync(path.join(targetDir, 'src'), { recursive: true })

// 1. package.json
const pkgJson = {
  name: `@nixlabs-games/${slug}`,
  version: '0.1.0',
  type: 'module',
  description: `${titleCase} minigame for Nixlabs Arcade`,
  main: './src/plugin.ts',
  scripts: {
    dev: 'vite',
    build: 'tsc && vite build',
    typecheck: 'tsc --noEmit',
  },
  dependencies: {
    react: '^19.1.1',
    'react-dom': '^19.1.1',
  },
  devDependencies: {
    '@types/react': '^19.1.13',
    '@types/react-dom': '^19.1.9',
    '@vitejs/plugin-react': '^5.0.2',
    typescript: '^5.8.3',
    vite: '^7.1.5',
  },
}
fs.writeFileSync(path.join(targetDir, 'package.json'), JSON.stringify(pkgJson, null, 2))

// 2. tsconfig.json
const tsconfig = {
  compilerOptions: {
    target: 'ES2024',
    module: 'ESNext',
    moduleResolution: 'Bundler',
    lib: ['ES2024', 'DOM', 'DOM.Iterable'],
    jsx: 'react-jsx',
    strict: true,
    exactOptionalPropertyTypes: true,
    noUncheckedIndexedAccess: true,
    skipLibCheck: true,
  },
  include: ['src'],
}
fs.writeFileSync(path.join(targetDir, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2))

// 3. src/manifest.ts
const manifestTs = `export const ${slug.replace(/-/g, '_')}Manifest = {
  slug: '${slug}',
  title: '${titleCase}',
  tagline: 'High-octane arcade action.',
  description: 'Master the mechanics and beat your record in ${titleCase}.',
  status: 'playable' as const,
  accent: 'orange' as const,
  tags: ['arcade', 'retro', 'action'],
  cover: '/assets/cover.jpg',
  banner: '/assets/banner.jpg',
  aspect: 3 / 4,
  scoreLabel: 'Score',
  bonusLabel: 'Candy',
  primaryLabel: 'Play',
  scoringNote: 'Survive and score points across waves.',
  startLine: 'Press Space or Click to begin.',
  intro: 'Welcome to ${titleCase}. Ready your reflexes.',
  pauseNote: 'Game paused. Take a breath.',
  tip: 'Timing is everything.',
  controls: [
    { input: 'Space / Click', action: 'Trigger Primary Action' },
    { input: 'Esc / P', action: 'Pause' },
  ],
  legend: [
    { swatch: 'blue' as const, text: 'Player' },
    { swatch: 'orange' as const, text: 'Hazards' },
  ],
  year: new Date().getFullYear(),
}
`
fs.writeFileSync(path.join(targetDir, 'src', 'manifest.ts'), manifestTs)

// 4. src/runtime.ts
const runtimeTs = `import { ${slug.replace(/-/g, '_')}Manifest } from './manifest'

export function create${titleCase.replace(/\s+/g, '')}Runtime(deps: { readonly current: any }) {
  let score = 0
  let isRunning = false
  let animId: number | null = null

  return {
    actions: {
      primary: () => {
        if (!isRunning) {
          isRunning = true
          deps.current.beginRun()
        }
      },
      pause: () => { isRunning = false },
      resume: () => { isRunning = true },
      restart: () => {
        score = 0
        isRunning = true
        deps.current.beginRun()
      },
      toggleMute: () => {},
    },
    attach: (host: any) => {
      const { canvas, context } = host
      const onFrameSub = host.onFrame((dt: number) => {
        if (!isRunning) return
        context.clearRect(0, 0, canvas.width, canvas.height)
        context.fillStyle = '#f6821f'
        context.fillRect(50, 50, 80, 80)
      })
      return {
        dispose: () => {
          onFrameSub.dispose()
        },
      }
    },
    dispose: () => {
      if (animId) cancelAnimationFrame(animId)
    },
  }
}
`
fs.writeFileSync(path.join(targetDir, 'src', 'runtime.ts'), runtimeTs)

// 5. src/achievements.ts
const achievementsTs = `export const ${slug.replace(/-/g, '_')}Achievements = [
  {
    id: '${slug}_first_step',
    pillar: '${slug}',
    track: 'First Steps',
    name: '🌟 First Flight',
    description: 'Play your first run in ${titleCase}.',
    icon: '🚀',
    maxProgress: null,
  },
  {
    id: '${slug}_veteran',
    pillar: '${slug}',
    track: 'Mastery',
    name: '🎖️ Seasoned Operator',
    description: 'Score 100 points in a single match.',
    icon: '⚡',
    maxProgress: 100,
  },
]
`
fs.writeFileSync(path.join(targetDir, 'src', 'achievements.ts'), achievementsTs)

// 6. src/profile-card.tsx
const profileCardTsx = `import type React from 'react'

export const ${slug.replace(/-/g, '_')}ProfileCard = {
  getMetrics: ({ stat }: any) => [
    { label: 'Personal Best', value: stat?.highscore ? String(stat.highscore) : '—' },
    { label: 'World Record', value: stat?.globalHighscore ? String(stat.globalHighscore) : '—' },
  ],
  runsLabel: 'Matches Played',
  actionLabel: {
    owner: 'Play Again',
    other: 'Challenge PB',
  },
}
`
fs.writeFileSync(path.join(targetDir, 'src', 'profile-card.tsx'), profileCardTsx)

// 7. src/plugin.ts
const pluginTs = `import { ${slug.replace(/-/g, '_')}Manifest } from './manifest'
import { create${titleCase.replace(/\s+/g, '')}Runtime } from './runtime'
import { ${slug.replace(/-/g, '_')}Achievements } from './achievements'
import { ${slug.replace(/-/g, '_')}ProfileCard } from './profile-card'

export const gamePlugin = {
  manifest: ${slug.replace(/-/g, '_')}Manifest,
  createRuntime: create${titleCase.replace(/\s+/g, '')}Runtime,
  achievements: ${slug.replace(/-/g, '_')}Achievements,
  profileCard: ${slug.replace(/-/g, '_')}ProfileCard,
  scoring: {
    mode: 'points',
    hasValidScore: (s: number | null) => s !== null && s > 0,
  },
}

export default gamePlugin
`
fs.writeFileSync(path.join(targetDir, 'src', 'plugin.ts'), pluginTs)

// 8. README.md
const readmeMd = `# ${titleCase} (@nixlabs-games/${slug})

Independent game repository for **Nixlabs Arcade**.

## Developing Locally

\`\`\`bash
npm install
npm run dev
\`\`\`

## Publishing to GitHub & Plugging into Main Product

1. Create and push repository using GitHub CLI:
   \`\`\`bash
   git init -b main
   git add .
   git commit -m "feat: initial scaffold for ${slug}"
   gh repo create <your-org>/game-${slug} --public --source=. --push
   \`\`\`

2. In the main \`minigames\` repository:
   Add entry to \`shared/game-registry.json\`:
   \`\`\`json
   {
     "slug": "${slug}",
     "title": "${titleCase}",
     "enabled": true,
     "source": { "type": "package", "name": "@nixlabs-games/${slug}" }
   }
   \`\`\`
`
fs.writeFileSync(path.join(targetDir, 'README.md'), readmeMd)

// Git initialization
try {
  execSync('git init -b main && git add . && git commit -m "feat: initial scaffold conforming to nixlabs game contract"', {
    cwd: targetDir,
    stdio: 'ignore',
  })
  console.log('✅ Initialized Git repository and committed scaffold files.')
} catch {
  console.warn('⚠️  Could not run git init (git might need user config).')
}

console.log(`\n🎉 Game repository ready at: ${targetDir}`)
console.log('\nNext steps:')
console.log(`  1. cd ${targetDir}`)
console.log(`  2. gh repo create <your-org>/game-${slug} --public --source=. --push`)
console.log(`  3. In minigames repo, add "${slug}" to shared/game-registry.json`)
