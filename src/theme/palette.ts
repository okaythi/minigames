/**
 * Single source of truth for colour values.
 *
 * `src/styles/tokens.css` exposes the same hexes as CSS custom properties for
 * the DOM side; this module is what the canvas renderers read, because a
 * 2D context cannot resolve `var(--nx-orange)`.
 *
 * Cloudflare's brand orange is used verbatim; everything else is either the
 * off-white surface (never pure #fff) or an accent tuned to the same warm
 * chroma so the set sits together.
 */

export const PALETTE = {
  /** Cloudflare "Princeton/Tango" orange - the exact brand hex. */
  orange: '#f6821f',
  orangeBright: '#fbad41',
  orangeDeep: '#d96c12',
  orangeGlow: '#ffd9a0',
  orangeTint: '#fdeadd',

  blue: '#1f6fd1',
  blueDeep: '#155aa8',
  blueTint: '#e4eefb',

  green: '#1f9d5b',
  greenDeep: '#167544',
  greenTint: '#e3f4ea',

  red: '#d8433d',
  redDeep: '#ab2f2a',
  redTint: '#fbe7e5',

  /** Off-white surfaces. `paper` is the page, `card` is one step brighter. */
  paper: '#faf7f2',
  card: '#fffdf9',
  sand: '#f2ece2',

  ink: '#232324',
  graphite: '#404041',
  slate: '#6f6d6a',
  line: '#e6e0d6',
  lineStrong: '#d5cec2',
} as const

export interface GameAccent {
  readonly base: string
  readonly deep: string
  readonly tint: string
}

const ACCENTS: Readonly<Record<'orange' | 'blue' | 'green' | 'red' | 'amber', GameAccent>> = {
  orange: { base: PALETTE.orange, deep: PALETTE.orangeDeep, tint: PALETTE.orangeTint },
  amber: { base: PALETTE.orangeBright, deep: PALETTE.orange, tint: '#fdf0d9' },
  blue: { base: PALETTE.blue, deep: PALETTE.blueDeep, tint: PALETTE.blueTint },
  green: { base: PALETTE.green, deep: PALETTE.greenDeep, tint: PALETTE.greenTint },
  red: { base: PALETTE.red, deep: PALETTE.redDeep, tint: PALETTE.redTint },
}

export const accentOf = (name: keyof typeof ACCENTS): GameAccent => ACCENTS[name]

/** rgba() string from a #rrggbb token - canvas has no color-mix() fallback. */
export function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace('#', '')
  const r = Number.parseInt(value.slice(0, 2), 16)
  const g = Number.parseInt(value.slice(2, 4), 16)
  const b = Number.parseInt(value.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`
}
