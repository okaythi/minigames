export interface TronFonts {
  readonly sans: string
  readonly mono: string
}

const FALLBACK_SANS = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
const FALLBACK_MONO = "ui-monospace, 'SF Mono', Menlo, Consolas, monospace"

export function fontsFor(canvas: HTMLCanvasElement): TronFonts {
  const styles = getComputedStyle(canvas)
  return {
    sans: styles.getPropertyValue('--nx-font-sans').trim() || FALLBACK_SANS,
    mono: styles.getPropertyValue('--nx-font-mono').trim() || FALLBACK_MONO,
  }
}
