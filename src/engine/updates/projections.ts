import type { ProjectionInterface } from './interfaces'
import type {
  DeveloperRationale,
  GamePillarProjection,
  ReleaseAggregate,
  ReleaseItem,
  ReleaseMeta,
  TagGroupProjection,
  UpdateTag,
} from './types'

const KNOWN_GAME_TITLES: Readonly<Record<string, string>> = {
  'avoid-the-spikes': 'Avoid the Spikes!',
  'fl-tron-3': 'FL Tron 3.0',
  'pong': 'Pong',
  'platform': 'Arcade Platform',
}

const TAG_SORT_ORDER: readonly UpdateTag[] = [
  'Balance',
  'New',
  'Fix',
  'Feature',
  'Polish',
]

function formatTitle(slug: string): string {
  if (slug in KNOWN_GAME_TITLES) {
    return KNOWN_GAME_TITLES[slug]!
  }
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export const defaultProjections: ProjectionInterface = {
  toGamePillars(items: readonly ReleaseItem[]): readonly GamePillarProjection[] {
    const map = new Map<string, ReleaseItem[]>()

    // Sort items by sortOrder first
    const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder)

    for (const item of sorted) {
      const slug = item.scope.targetId
      const list = map.get(slug)
      if (list) {
        list.push(item)
      } else {
        map.set(slug, [item])
      }
    }

    const pillars: GamePillarProjection[] = []
    for (const [gameSlug, pillarItems] of map.entries()) {
      pillars.push({
        gameSlug,
        gameTitle: formatTitle(gameSlug),
        items: pillarItems,
      })
    }

    return pillars
  },

  toTagGroups(items: readonly ReleaseItem[]): readonly TagGroupProjection[] {
    const map = new Map<UpdateTag, ReleaseItem[]>()

    const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder)

    for (const item of sorted) {
      const list = map.get(item.tag)
      if (list) {
        list.push(item)
      } else {
        map.set(item.tag, [item])
      }
    }

    const groups: TagGroupProjection[] = []
    for (const tag of TAG_SORT_ORDER) {
      const tagItems = map.get(tag)
      if (tagItems && tagItems.length > 0) {
        groups.push({
          tag,
          items: tagItems,
        })
      }
    }

    return groups
  },

  toAggregate(
    meta: ReleaseMeta,
    items: readonly ReleaseItem[],
    rationale?: DeveloperRationale,
  ): ReleaseAggregate {
    return {
      meta,
      rationale,
      items,
      pillars: defaultProjections.toGamePillars(items),
      tagGroups: defaultProjections.toTagGroups(items),
    }
  },
}