import cover from './cover.png'
import banner from './banner.png'
import type { GameManifest } from '../types'
import { GameFlags } from '../../../shared/flags'

export const manifest: GameManifest = {
  slug: 'card-jitsu',
  title: 'Card-Jitsu',
  flags: GameFlags.NONE,
  tagline: 'Master Fire, Water, and Snow to earn your belts and defeat Sensei.',


  description:
    'The Club Penguin martial arts card game. Face Sensei in the ancient Dojo, command the elemental trinity, and unleash unique power cards to earn your Black Belt.',
  status: 'new',
  accent: 'orange',
  layout: 'horizontal',
  tags: ['Club Penguin', 'Strategy', 'Card Battle'],
  cover,
  banner,
  controls: [
    { input: 'Mouse Hover', action: 'Inspect card & view elevated power details' },
    { input: 'Left Click', action: 'Lock in chosen card for the center clash' }
  ],
  mechanics: [
    {
      title: 'The Elemental Trinity',
      body: 'Fire burns Snow, Snow freezes Water, and Water douses Fire. When both ninjas choose matching elements, the higher numeric value wins the clash.',
    },
    {
      title: 'Triad Victory Conditions',
      body: 'Win 3 rounds with either three distinct elements (Fire + Water + Snow) in three different colors, or three of the same element in three different colors.',
    },
    {
      title: 'Power Cards',
      body: 'Power cards can alter this clash or set up the next: turn Water into Fire for one round, make lower same-element values win, boost your card by +2, or freeze an element.',
    },
    {
      title: 'The Real Sensei',
      body: 'Sensei behaves exactly like on Club Penguin. Or at least very close to it. Can you beat him?',
    },
  ],
  year: 2026,
  aspect: 1.5833, // 950 x 600 widescreen
  scoreLabel: 'Matches Won',
  bonusLabel: 'Candy',
  primaryLabel: 'Enter Dojo',
  scoringNote:
    'Defeat Sensei to earn your Master Ninja status.',
  startLine: 'Enter the Ancient Dojo',
  intro: 'Select your card wisely and anticipate your opponent’s elemental path.',
  pauseNote: 'Meditation in progress. Click resume to continue your duel.',
  tip: 'Track which elements you and your oponent need to complete a triad. Anticipate which counter card they will play to block you.',
  legend: [
    { swatch: 'red', text: 'Fire Element' },
    { swatch: 'blue', text: 'Water Element' },
    { swatch: 'green', text: 'Snow Element' },
    { swatch: 'amber', text: 'Power Boost / Inversion' },
    { swatch: 'graphite', text: 'Sensei Black Belt' },
  ],
}
