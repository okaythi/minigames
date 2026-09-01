import cover from './cover.jpg'
import banner from './banner.jpg'
import type { GameManifest, GameLegendItem } from '../types'

export const PONG_SLUG = 'pong' as const

const LEGEND: readonly GameLegendItem[] = [
  { swatch: 'orange', text: 'the ball' },
  { swatch: 'blue', text: 'powerups' },
  { swatch: 'green', text: 'candy' },
]

export const pongManifest: GameManifest = {
  slug: PONG_SLUG,
  title: 'Pong',
  tagline: 'Beat the AI using trajectory prediction and loadouts.',
  description: 'A classic game of Pong where the AI predicts the ball trajectory. Choose your difficulty, equip power-ups with your candy, and outsmart the AI.',
  status: 'playable',
  accent: 'orange',
  tags: ['arcade', 'reflex', 'pong', 'canvas'],
  cover,
  banner,
  controls: [
    { input: 'Mouse / Touch', action: 'Move paddle' },
    { input: '1-5', action: 'Use equipped powerup' },
    { input: 'P / Esc', action: 'Pause' },
    { input: 'M', action: 'Mute' },
    { input: 'Enter', action: 'Restart after a match' },
  ],
  mechanics: [
    {
      title: 'The AI',
      body: 'The AI calculates exactly where the ball will land. On higher difficulties, it will use powerups to outmaneuver you.',
    },
    {
      title: 'Powerups',
      body: 'Spend global candy before the match to equip Speed Boosts, Paddle Extensions, Magnets, or Glass Walls.',
    },
    {
      title: 'Progression',
      body: 'Beat Easy, Normal, and Hard to unlock Very Hard. The Secret Boss calculates your kinematic limits and guarantees a point if it can.',
    },
  ],
  year: 2026,

  // --- copy for the shared chrome -------------------------------------------
  aspect: 3 / 4,
  scoreLabel: 'Max Difficulty Cleared',
  bonusLabel: 'Candy',
  primaryLabel: 'Play',
  scoringNote: 'Clear difficulties to advance your progression index.',
  startLine: 'Click, tap or hit Enter to start.',
  intro: 'Choose your loadout and difficulty. Move the paddle at the bottom to beat the AI at the top.',
  pauseNote: 'Use 1-5 to trigger your equipped powerups.',
  tip: 'Hold the Magnet (if equipped) to stall the ball and ruin the AI\'s timing.',
  legend: LEGEND,
}
