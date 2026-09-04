import type { GameManifest } from '../types'

export const manifest: GameManifest = {
  slug: 'card-jitsu',
  title: 'Card-Jitsu',
  tagline: 'Master Fire, Water, and Snow to earn your belts and defeat Sensei.',
  description:
    'The authentic Club Penguin martial arts card game. Face Sensei in the ancient Dojo, command the elemental trinity, and unleash unique power cards to earn your Black Belt.',
  status: 'playable',
  accent: 'orange',
  layout: 'horizontal',
  tags: ['Club Penguin', 'Strategy', 'Card Battle', 'Sensei', 'Martial Arts'],
  cover: '/games/card-jitsu/cover.svg',
  controls: [
    { input: 'Mouse Hover', action: 'Inspect card & view elevated power details' },
    { input: 'Left Click', action: 'Lock in chosen card for the center clash' },
    { input: 'Escape', action: 'Pause meditation or open Dojo menu' },
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
      body: 'Special power cards grant tactical boosts for the following round: inverting values so lower numbers win, boosting your card value by +2, or freezing an element.',
    },
    {
      title: 'Authentic Sensei AI',
      body: 'Sensei evaluates his honest 5-card hand using tactical triad completion and opponent blocking heuristics, scaling dynamically to your current belt.',
    },
  ],
  year: 2026,
  aspect: 1.5833, // 950 x 600 widescreen
  scoreLabel: 'Matches Won',
  bonusLabel: 'Candy',
  primaryLabel: 'Enter Dojo',
  scoringNote:
    'Defeat Sensei to earn 50 Candy and advance your ninja belt rank towards the Black Belt.',
  startLine: 'Enter the Ancient Dojo',
  intro: 'Select your card wisely and anticipate your opponent’s elemental path.',
  pauseNote: 'Meditation in progress. Click resume to continue your duel.',
  tip: 'Track which elements you and Sensei need to complete a triad. Anticipate which counter card he will play to block you.',
  legend: [
    { swatch: 'red', text: 'Fire Element' },
    { swatch: 'blue', text: 'Water Element' },
    { swatch: 'green', text: 'Snow Element' },
    { swatch: 'amber', text: 'Power Boost / Inversion' },
    { swatch: 'graphite', text: 'Sensei Black Belt' },
  ],
}
