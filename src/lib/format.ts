/** Presentation-only helpers. Nothing here knows about games. */

/** 1234 -> "1.2K", 1_500_000 -> "1.5M". Keeps card widths stable. */
export function compactCount(value: number): string {
  if (!Number.isFinite(value) || value < 0) {
    return '0'
  }
  if (value < 1000) {
    return String(Math.trunc(value))
  }
  const units = ['K', 'M', 'B', 'T'] as const
  let scaled = value
  let unit: string = ''
  for (const candidate of units) {
    if (scaled < 1000) {
      break
    }
    scaled /= 1000
    unit = candidate
  }
  const digits = scaled < 10 ? 2 : scaled < 100 ? 1 : 0
  return `${scaled.toFixed(digits)}${unit}`
}

/** 63 -> "0:63", 95 -> "1:35" - used by the run summary. */
export function formatSeconds(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return minutes === 0 ? `${rest}s` : `${minutes}m ${rest.toString().padStart(2, '0')}s`
}
