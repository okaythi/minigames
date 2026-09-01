import cover from './cover.jpg'
import banner from './banner.jpg'
import type { GameManifest } from '../types'

export const AVOID_SLUG = 'avoid-the-spikes' as const

export const avoidTheSpikesManifest: GameManifest = {
  slug: AVOID_SLUG,
  title: 'Avoid the Spikes!',
  tagline: 'Fall, flap, bounce. Every wall you touch arms the next one.',
  description:
    'A one-button reflex game inside a vertical box. Gravity always pulls you down, a click throws you up and forward, and each wall bounce scores a point - but every contact sprouts a fresh row of teeth on the far wall, so you have to re-aim your height mid-flight. Past ten points, floating spikes join in, and the ceiling and floor have never once been safe.',
  status: 'playable',
  accent: 'orange',
  tags: ['arcade', 'reflex', 'one-button', 'highscore', 'canvas'],
  cover,
  banner,
  controls: [
    { input: 'Click / tap', action: 'Flap up and forward' },
    { input: 'Space', action: 'Flap (same thing)' },
    { input: 'P / Esc', action: 'Pause' },
    { input: 'M', action: 'Mute' },
    { input: 'Enter', action: 'Restart after a crash' },
  ],
  mechanics: [
    {
      title: 'The box',
      body: 'A vertical arena. The left and right walls are the only safe places to be, and both of them are lethal at the top and bottom.',
    },
    {
      title: 'Falling is the default',
      body: 'Gravity pulls every frame. A click, tap or Space throws the pod up and a little forward - and because a flap sets the velocity instead of adding to it, mashing only pins you into the ceiling teeth.',
    },
    {
      title: 'Wall bounce = +1',
      body: 'Touching a wall reflects you and scores exactly one point. The contact is checked with a separating-axis test against the actual triangles, so a graze of a spike tip is a save, not a death.',
    },
    {
      title: 'Every bounce re-arms the far wall',
      body: 'The wall you are flying to sprouts a random row of teeth the instant you leave the other one. Rows always leave at least one gap wide enough to land in, and the cell you are tracking is guaranteed open.',
    },
    {
      title: 'Floating spikes, from 11 bounces',
      body: 'Past ten points, centre-screen spikes drift in on vertical or horizontal paths. They never reach the walls, so they punish bad timing without ever hiding a gap.',
    },
    {
      title: 'Ceiling and floor',
      body: 'Permanently lined with teeth. Fly too high or fall too low and the run ends immediately.',
    },
    {
      title: 'Speed grows logarithmically',
      body: 'Cruise speed is base * (1 + 0.075 * ln(1 + score)) - about 13% faster by bounce ten and under 30% faster by bounce a hundred, which is slow enough to never read as a difficulty spike.',
    },
    {
      title: 'Candy',
      body: 'Gems and candy appear in the middle band. Every piece you grab is banked to localStorage and stays banked between runs.',
    },
  ],
  scores: true,
  scoreUnit: 'bounces',
  year: 2026,
}
