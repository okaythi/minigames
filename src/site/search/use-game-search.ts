import { useMemo } from 'react'
import type { GameManifest } from '../../games/types'
import { fuzzyMatch, type FuzzyMatch } from './fuzzy'

export interface SearchResult {
  readonly manifest: GameManifest
  readonly score: number
  readonly titleMatch: FuzzyMatch
  readonly matchedTags: readonly string[]
}

const TAG_WEIGHT = 0.45

/** Ranks title hits above tag hits; blank query returns the catalogue order. */
export function useGameSearch(
  query: string,
  manifests: readonly GameManifest[],
): { readonly results: readonly SearchResult[]; readonly trimmed: string } {
  const trimmed = query.trim()

  return useMemo(() => {
    if (trimmed.length === 0) {
      return { results: [], trimmed }
    }
    const scored: SearchResult[] = []

    for (const manifest of manifests) {
      const titleMatch = fuzzyMatch(trimmed, manifest.title)
      let best = titleMatch === null ? 0 : titleMatch.score
      const matchedTags: string[] = []

      for (const tag of [...manifest.tags, manifest.slug, manifest.status]) {
        const tagMatch = fuzzyMatch(trimmed, tag)
        if (tagMatch !== null) {
          matchedTags.push(tag)
          best = Math.max(best, tagMatch.score * TAG_WEIGHT)
        }
      }

      // A title hit always outranks an equal tag hit.
      const score = titleMatch === null ? best : best + 60
      if (titleMatch === null && matchedTags.length === 0) {
        continue
      }
      scored.push({
        manifest,
        score: Math.round(score),
        titleMatch: titleMatch ?? { score: 0, ranges: [] },
        matchedTags,
      })
    }

    scored.sort((a, b) => b.score - a.score || a.manifest.title.localeCompare(b.manifest.title))
    return { results: scored, trimmed }
  }, [trimmed, manifests])
}
