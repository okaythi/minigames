import { useMemo, useState } from 'react'
import type { Badge } from '../../../shared/auth-protocol'
import { ACHIEVEMENT_DEFS } from '../../../shared/achievement-defs'
import { DeveloperBadge } from '../ui/developer-badge'
import './achievements-showcase.css'

interface AchievementsShowcaseProps {
  readonly badges: readonly Badge[]
  readonly title?: string
}

type PillarFilter = 'all' | 'platform' | 'avoid-the-spikes' | 'pong' | 'fl-tron-3'
type StatusFilter = 'all' | 'unlocked' | 'locked'

interface EnrichedBadge extends Badge {
  pillar: string
  track: string
  maxProgress: number | null
  progress?: { current: number; max: number } | undefined
}

export function AchievementsShowcase({ badges, title = 'Arcade Achievements & Badges' }: AchievementsShowcaseProps) {
  const [selectedPillar, setSelectedPillar] = useState<PillarFilter>('all')
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Merge the catalogue with the user's unlocked badge status
  const allEnrichedBadges = useMemo<EnrichedBadge[]>(() => {
    const badgeMap = new Map<string, Badge>()
    for (const b of badges) {
      badgeMap.set(b.id, b)
    }

    return ACHIEVEMENT_DEFS.map((def) => {
      const userBadge = badgeMap.get(def.id)
      return {
        id: def.id,
        pillar: def.pillar,
        track: def.track,
        name: def.name,
        description: def.description,
        icon: def.icon,
        maxProgress: def.maxProgress,
        unlocked: userBadge?.unlocked ?? false,
        unlockedAt: userBadge?.unlockedAt ?? null,
        progress: userBadge?.progress ?? (def.maxProgress !== null ? { current: 0, max: def.maxProgress } : undefined),
      }
    })
  }, [badges])

  const totalUnlocked = useMemo(() => {
    return allEnrichedBadges.filter((b) => b.unlocked).length
  }, [allEnrichedBadges])

  const unlockPercentage = Math.round((totalUnlocked / (allEnrichedBadges.length || 1)) * 100)

  // Filter badges
  const filteredBadges = useMemo(() => {
    return allEnrichedBadges.filter((b) => {
      // Pillar filter
      if (selectedPillar !== 'all' && b.pillar !== selectedPillar) {
        return false
      }
      // Status filter
      if (selectedStatus === 'unlocked' && !b.unlocked) return false
      if (selectedStatus === 'locked' && b.unlocked) return false
      // Search query
      if (searchQuery.trim().length > 0) {
        const query = searchQuery.toLowerCase()
        const matchesName = b.name.toLowerCase().includes(query)
        const matchesDesc = b.description.toLowerCase().includes(query)
        const matchesTrack = b.track.toLowerCase().includes(query)
        if (!matchesName && !matchesDesc && !matchesTrack) return false
      }
      return true
    })
  }, [allEnrichedBadges, selectedPillar, selectedStatus, searchQuery])

  // Group filtered badges by track
  const groupedByTrack = useMemo(() => {
    const groups = new Map<string, EnrichedBadge[]>()
    for (const badge of filteredBadges) {
      const list = groups.get(badge.track) || []
      list.push(badge)
      groups.set(badge.track, list)
    }
    return Array.from(groups.entries())
  }, [filteredBadges])

  return (
    <div className="nx-achievements-showcase">
      {/* 1. Header with Stats & Global Progress Bar */}
      <div className="nx-achievements-header">
        <div className="nx-achievements-header-top">
          <div className="nx-achievements-title-group">
            <h2 className="nx-achievements-title">{title}</h2>
          </div>
          <div className="nx-achievements-stats">
            {totalUnlocked} / {allEnrichedBadges.length} Unlocked ({unlockPercentage}%)
          </div>
        </div>
        <div className="nx-achievements-progress-bar-bg">
          <div
            className="nx-achievements-progress-bar-fill"
            style={{ width: `${unlockPercentage}%` }}
          />
        </div>
      </div>

      {/* 2. Controls (Tabs + Search) */}
      <div className="nx-achievements-controls">
        <div className="nx-achievements-tabs">
          <button
            type="button"
            className="nx-achievements-tab"
            data-active={selectedPillar === 'all' ? 'true' : 'false'}
            onClick={() => setSelectedPillar('all')}
          >
            All (80)
          </button>
          <button
            type="button"
            className="nx-achievements-tab"
            data-active={selectedPillar === 'platform' ? 'true' : 'false'}
            onClick={() => setSelectedPillar('platform')}
          >
            🌐 Platform & Meta
          </button>
          <button
            type="button"
            className="nx-achievements-tab"
            data-active={selectedPillar === 'avoid-the-spikes' ? 'true' : 'false'}
            onClick={() => setSelectedPillar('avoid-the-spikes')}
          >
            🎯 Avoid the Spikes!
          </button>
          <button
            type="button"
            className="nx-achievements-tab"
            data-active={selectedPillar === 'pong' ? 'true' : 'false'}
            onClick={() => setSelectedPillar('pong')}
          >
            🏓 Pong
          </button>
          <button
            type="button"
            className="nx-achievements-tab"
            data-active={selectedPillar === 'fl-tron-3' ? 'true' : 'false'}
            onClick={() => setSelectedPillar('fl-tron-3')}
          >
            🏍️ FL Tron 3.0
          </button>
        </div>

        <div className="nx-achievements-tabs">
          <button
            type="button"
            className="nx-achievements-tab"
            data-active={selectedStatus === 'all' ? 'true' : 'false'}
            onClick={() => setSelectedStatus('all')}
          >
            All
          </button>
          <button
            type="button"
            className="nx-achievements-tab"
            data-active={selectedStatus === 'unlocked' ? 'true' : 'false'}
            onClick={() => setSelectedStatus('unlocked')}
          >
            ✓ Unlocked
          </button>
          <button
            type="button"
            className="nx-achievements-tab"
            data-active={selectedStatus === 'locked' ? 'true' : 'false'}
            onClick={() => setSelectedStatus('locked')}
          >
            🔒 Locked
          </button>
        </div>

        <input
          type="search"
          className="nx-achievements-search-input"
          placeholder="Filter achievements..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* 3. Badge Groups */}
      {groupedByTrack.length === 0 ? (
        <div className="nx-achievements-empty">
          No achievements match the current filters.
        </div>
      ) : (
        groupedByTrack.map(([trackName, trackBadges]) => (
          <div key={trackName} className="nx-achievements-track-group">
            <div className="nx-achievements-track-title">
              <span>{trackName}</span>
              <span>({trackBadges.filter((b) => b.unlocked).length}/{trackBadges.length})</span>
            </div>

            <div className="nx-achievements-grid">
              {trackBadges.map((badge) => {
                const hasProgress = badge.maxProgress !== null && badge.progress !== undefined
                const currentProgress = badge.progress?.current ?? 0
                const maxProgress = badge.maxProgress ?? 1
                const progressPct = Math.min(100, Math.round((currentProgress / maxProgress) * 100))

                return (
                  <div
                    key={badge.id}
                    className="nx-achievement-card"
                    data-unlocked={badge.unlocked ? 'true' : 'false'}
                  >
                    <div className="nx-achievement-card-icon" aria-hidden="true">
                      {badge.id === 'identity_developer' ? (
                        <DeveloperBadge size={30} title="Develops games for our Lab." />
                      ) : (
                        badge.icon
                      )}
                    </div>

                    <div className="nx-achievement-card-content">
                      <div className="nx-achievement-card-header">
                        <span className="nx-achievement-card-name">{badge.name}</span>
                        {badge.unlocked ? (
                          <span className="nx-achievement-card-check" title="Unlocked">✓</span>
                        ) : (
                          <span className="nx-achievement-card-lock" title="Locked">🔒</span>
                        )}
                      </div>

                      <p className="nx-achievement-card-desc">{badge.description}</p>

                      {hasProgress && !badge.unlocked && (
                        <div className="nx-achievement-card-progress-wrap">
                          <div className="nx-achievement-card-progress-text">
                            <span>Progress</span>
                            <span>{currentProgress.toLocaleString()} / {maxProgress.toLocaleString()}</span>
                          </div>
                          <div className="nx-achievement-card-progress-bar">
                            <div
                              className="nx-achievement-card-progress-fill"
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
