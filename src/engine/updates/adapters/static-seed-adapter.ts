import type { ReaderInterface } from '../interfaces'
import type {
  DeveloperRationale,
  ReleaseAggregate,
  ReleaseId,
  ReleaseItem,
  ReleaseMeta,
  TargetScopeType,
} from '../types'
import { asItemId, asReleaseId } from '../types'
import { defaultProjections } from '../projections'
import { UPDATE_RELEASES } from '../../../data/updates'

/**
 * Adapter converting legacy static data into normalized engine aggregates.
 * Provides guaranteed fallback and baseline seed data with zero latency.
 */
export class StaticSeedAdapter implements ReaderInterface {
  private readonly aggregates: readonly ReleaseAggregate[]

  public constructor() {
    this.aggregates = UPDATE_RELEASES.map((rel, relIndex) => {
      const releaseId = asReleaseId(`rel_${rel.version}`)

      const meta: ReleaseMeta = {
        id: releaseId,
        globalVersion: rel.version,
        title: rel.title,
        headline: rel.headline,
        status: 'published',
        releaseDate: rel.date,
        publishedAt: Date.parse(rel.date) || Date.now() - relIndex * 86400000 * 7,
      }

      const rationale: DeveloperRationale | undefined = rel.developerRationale
        ? {
            releaseId,
            content: rel.developerRationale,
          }
        : undefined

      const items: ReleaseItem[] = []
      let itemCounter = 0

      for (const pillar of rel.pillars) {
        for (const ch of pillar.changes) {
          itemCounter += 1
          items.push({
            id: asItemId(`${releaseId}_item_${itemCounter}`),
            releaseId,
            scope: {
              type: pillar.gameSlug === 'platform' ? 'platform' : 'game',
              targetId: pillar.gameSlug,
              entityName: ch.subject,
            },
            tag: ch.tag,
            subject: ch.subject,
            description: ch.description,
            sortOrder: itemCounter,
            createdAt: meta.publishedAt ?? Date.now(),
            updatedAt: meta.publishedAt ?? Date.now(),
          })
        }
      }

      return defaultProjections.toAggregate(meta, items, rationale)
    })
  }

  public async getPublished(): Promise<readonly ReleaseAggregate[]> {
    return this.aggregates
  }

  public async getDrafts(): Promise<readonly ReleaseAggregate[]> {
    return []
  }

  public async getLatestPublished(): Promise<ReleaseAggregate | null> {
    return this.aggregates[0] ?? null
  }

  public async getReleaseById(id: ReleaseId): Promise<ReleaseAggregate | null> {
    return this.aggregates.find((agg) => agg.meta.id === id) ?? null
  }

  public async getItemsByScope(
    scopeType: TargetScopeType,
    targetId?: string,
  ): Promise<readonly ReleaseItem[]> {
    const results: ReleaseItem[] = []
    for (const agg of this.aggregates) {
      for (const item of agg.items) {
        if (item.scope.type === scopeType) {
          if (!targetId || item.scope.targetId === targetId) {
            results.push(item)
          }
        }
      }
    }
    return results
  }
}