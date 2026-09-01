/**
 * Tiny fuzzy matcher (subsequence + word-boundary scoring). Enough for a game
 * catalogue, no dependency, and it returns highlight ranges for the UI.
 */

export interface FuzzyMatch {
  readonly score: number
  /** [start, end) pairs inside the target that the query consumed. */
  readonly ranges: readonly Readonly<{ start: number; end: number }>[]
}

const BOUNDARY_BONUS = 26
const CONSECUTIVE_BONUS = 12
const START_BONUS = 34
const PENALTY_PER_GAP = 2

const isBoundary = (text: string, index: number): boolean =>
  index === 0 || /[\s\-_/.|]/.test(text.charAt(index - 1))

export function fuzzyMatch(rawQuery: string, target: string): FuzzyMatch | null {
  const query = rawQuery.trim().toLowerCase()
  if (query.length === 0) {
    return { score: 0, ranges: [] }
  }
  const haystack = target.toLowerCase()

  // Fast path: a literal substring is always the best possible hit.
  const direct = haystack.indexOf(query)
  if (direct >= 0) {
    const boundaryBoost = isBoundary(haystack, direct) ? BOUNDARY_BONUS : 0
    return {
      score: 1000 - direct * 3 + query.length * 10 + boundaryBoost,
      ranges: [{ start: direct, end: direct + query.length }],
    }
  }

  const ranges: { start: number; end: number }[] = []
  let score = 0
  let cursor = -1

  for (const needle of query) {
    if (needle === ' ') {
      continue
    }
    let index = haystack.indexOf(needle, cursor + 1)
    if (index < 0) {
      return null
    }
    // Allow skipping small gaps, but charge for them.
    const gap = index - cursor - 1
    if (cursor >= 0 && gap > 12) {
      return null
    }
    score += 20
    if (cursor >= 0) {
      score -= gap * PENALTY_PER_GAP
      if (gap === 0) {
        score += CONSECUTIVE_BONUS
      }
    } else if (index === 0) {
      score += START_BONUS
    }
    if (isBoundary(haystack, index)) {
      score += BOUNDARY_BONUS
    }
    ranges.push({ start: index, end: index + 1 })
    cursor = index
  }

  // Long queries that consume most of the title deserve a boost.
  score += (query.length / Math.max(haystack.length, 1)) * 120

  return score > 0 ? { score: Math.round(score), ranges } : null
}

/** Merges adjacent ranges so the UI never renders single-letter highlights. */
export function coalesceRanges(
  ranges: ReadonlyArray<Readonly<{ start: number; end: number }>>,
): ReadonlyArray<Readonly<{ start: number; end: number }>> {
  const merged: { start: number; end: number }[] = []
  for (const range of [...ranges].sort((a, b) => a.start - b.start)) {
    const last = merged.at(-1)
    if (last !== undefined && range.start <= last.end + 1) {
      last.end = Math.max(last.end, range.end)
    } else {
      merged.push({ ...range })
    }
  }
  return merged
}
