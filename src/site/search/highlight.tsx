import type { ReactNode } from 'react'
import type { FuzzyMatch } from './fuzzy'
import { coalesceRanges } from './fuzzy'

/** Renders the matched ranges of a fuzzy hit with <mark> segments. */
export function Highlighted({ text, match }: { readonly text: string; readonly match: FuzzyMatch }) {
  const ranges = coalesceRanges(match.ranges)
  if (ranges.length === 0) {
    return <>{text}</>
  }

  const nodes: ReactNode[] = []
  let cursor = 0

  ranges.forEach((range, index) => {
    if (range.start > cursor) {
      nodes.push(text.slice(cursor, range.start))
    }
    nodes.push(
      <mark key={`${index}-${range.start}`} className="nx-search-mark">
        {text.slice(range.start, range.end)}
      </mark>,
    )
    cursor = range.end
  })

  if (cursor < text.length) {
    nodes.push(text.slice(cursor))
  }

  return <>{nodes}</>
}
