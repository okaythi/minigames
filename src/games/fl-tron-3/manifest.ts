import cover from './cover.jpg'
import banner from './banner.jpg'
import type { GameManifest, GameLegendItem } from '../types'
import { formatTronScore } from './view-model'

export const TRON_SLUG = 'fl-tron-3' as const

const LEGEND: readonly GameLegendItem[] = [
  { swatch: 'blue', text: 'Player 1 light trail' },
  { swatch: 'orange', text: 'AI / Player 2 light trail' },
  { swatch: 'graphite', text: 'arena perimeter hazard' },
]

export const flTron3Manifest: GameManifest = {
  slug: TRON_SLUG,
  title: 'FL Tron 3.0',
  tagline: 'Outmanoeuvre the AI on a neon grid with precision 90° turns and high-speed turbos.',
  description:
    'A high-speed light cycle arena duel. Navigate a top-down 2D grid, lay down solid light walls, and force your opponent to crash across a 6-level campaign featuring scaling tactical AI.',
  status: 'playable',
  accent: 'orange',
  tags: ['arcade', 'retro', 'tron', 'cyberpunk', 'reflex', 'canvas'],
  cover,
  banner,
  controls: [
    { input: 'Arrow Keys', action: 'Turn light cycle 90°' },
    { input: 'Spacebar', action: 'Activate Turbo boost (3 per round)' },
    { input: 'P / Esc', action: 'Pause / Resume' },
    { input: 'M', action: 'Mute / Unmute audio' },
    { input: 'Enter', action: 'Start / Restart' },
  ],
  mechanics: [
    {
      title: 'Light Walls & Elimination',
      body: 'Your cycle continuously lays an impenetrable light wall. Colliding with arena bounds, enemy trails, or your own trail causes instant elimination.',
    },
    {
      title: 'Tactical Turbo',
      body: 'Each round provides 3 Turbo boosts (1.8x speed for 1.2s). Use them to cut across enemy vectors, box opponents in, or escape tight pinches.',
    },
    {
      title: '6-Level AI Campaign',
      body: 'Battle through 6 distinct AI archetypes (Novice, Scout, Hunter, Tactician, Assassin, Master Core). First to 3 round wins advances to the next level.',
    },
  ],
  year: 2026,

  // --- copy for the shared chrome -------------------------------------------
  aspect: 3 / 4,
  scoreLabel: 'Clear Time',
  formatScore: formatTronScore,
  bonusLabel: 'Turbos',
  runDurationLabel: 'Clear Time',
  primaryLabel: 'Play',
  scoringNote: 'Win 3 rounds per level to advance. Total run time and levels cleared determine your score.',
  startLine: 'Arrow keys to steer · Space for Turbo · Enter to begin.',
  intro: 'Choose your mode and battle through 6 cyber arenas against escalating tactical AI opponents.',
  pauseNote: 'Spacebar activates Turbo boost. Use corners and speed bursts to box the enemy in.',
  tip: 'Input buffering allows you to queue turns before reaching intersections.',
  legend: LEGEND,
}
