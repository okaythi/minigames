import { useEffect, useState } from 'react'
import { getPublicProfile, getMe } from '../services/auth-api'
import type { UserPublicProfileResponse, UserProfileResponse, UserGameStat } from '../../shared/auth-protocol'
import { MANIFESTS } from '../games/registry'
import { Link } from '../app/link'
import { ROUTES } from '../app/parse-route'
import { SettingsDrawer } from '../components/settings-drawer'
import { AchievementsShowcase } from '../components/achievements/achievements-showcase'
import { DeveloperBadge } from '../components/ui/developer-badge'
import { BadgeTooltip } from '../components/ui/badge-tooltip'
import { hasFlag, UserFlags, FLAGS_METADATA } from '../../shared/flags'
import { getAchievementBus } from '../lib/achievement-bus'
import './user-profile.css'

interface UserProfilePageProps {
  readonly username: string
}

export function UserProfilePage({ username }: UserProfilePageProps) {
  const [profile, setProfile] = useState<UserPublicProfileResponse | null>(null)
  const [currentUser, setCurrentUser] = useState<UserProfileResponse | null>(null)
  const [isSettingsDrawerOpen, setIsSettingsDrawerOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false

    Promise.all([getPublicProfile(username), getMe()])
      .then(([publicProf, me]) => {
        if (cancelled) return
        if (publicProf) {
          setProfile(publicProf)
          setCurrentUser(me)
        } else {
          setError(true)
        }
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [username])

  const handleCopyLink = () => {
    const url = window.location.href
    void navigator.clipboard.writeText(url)
    setCopied(true)
    getAchievementBus().unlock('social_passport_stamp')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleProfileUpdated = (updated: UserProfileResponse) => {
    setCurrentUser(updated)
    setProfile((prev) => {
      if (!prev) return null
      return {
        ...prev,
        nickname: updated.nickname,
        pfpUrl: updated.pfpUrl,
        nicknameChangedCount: updated.nicknameChangedCount,
      }
    })
  }

  if (loading) {
    return (
      <div className="nx-profile-page" style={{ textAlign: 'center', padding: '80px var(--nx-gutter)' }}>
        <div style={{ color: 'var(--nx-slate)', fontFamily: 'var(--nx-font-mono)', fontSize: '14px' }}>
          Loading player passport...
        </div>
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="nx-profile-page">
        <div className="nx-empty">
          <strong>Player Not Found</strong>
          <span>No user matches @{username}.</span>
          <div style={{ marginTop: '16px' }}>
            <Link to={ROUTES.home} className="nx-passport-btn">
              Return to Games
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const isOwner = currentUser?.username.toLowerCase() === profile.username.toLowerCase()
  const joinDateText = formatJoinDate(profile.createdOn)

  // Find best game to challenge (only games where user has an established personal best)
  const hasPb = (game: UserGameStat): boolean => {
    if (game.highscore === null) return false
    if (game.slug === 'fl-tron-3') return game.highscore > 1000
    return game.highscore > 0
  }
  const gamesWithPb = Object.values(profile.games).filter(hasPb)
  const bestGame = gamesWithPb.length > 0
    ? gamesWithPb.reduce((best, curr) => {
        if (!best) return curr
        return (curr.highscore ?? 0) > (best.highscore ?? 0) ? curr : best
      }, gamesWithPb[0])
    : null

  return (
    <div className="nx-profile-page">
      {/* ==================================================================
          1. HERO PLAYER PASSPORT
          ================================================================== */}
      <div className="nx-player-passport">
        <div className="nx-passport-glow-bar" />

        <div className="nx-passport-body">
          <div className="nx-passport-identity">
            <div className="nx-passport-avatar-wrapper">
              {profile.pfpUrl ? (
                <img
                  src={profile.pfpUrl}
                  alt={profile.username}
                  className="nx-passport-avatar-img"
                />
              ) : (
                profile.username.charAt(0).toUpperCase()
              )}
            </div>

            <div className="nx-passport-meta">
              <div className="nx-passport-name-row">
                <h1 className="nx-passport-username">@{profile.username}</h1>
                {hasFlag(profile.flags, UserFlags.STAFF) && (
                  <BadgeTooltip label={FLAGS_METADATA[UserFlags.STAFF]?.name ?? 'Staff'}>
                    <DeveloperBadge size={22} title="" />
                  </BadgeTooltip>
                )}
                {profile.nickname && (
                  <span className="nx-passport-nickname">{profile.nickname}</span>
                )}
              </div>

              {(hasFlag(profile.flags, UserFlags.USER_PIONEER) || profile.legacyUser) && (
                <div className="nx-passport-pioneer-row">
                  <span className="nx-passport-pioneer-pill">
                    <span>⚡</span> Pioneer
                  </span>
                </div>
              )}

              <div className="nx-passport-submeta">
                <span>Joined {joinDateText}</span>
              </div>
            </div>
          </div>

          <div className="nx-passport-actions">
            <button
              type="button"
              className="nx-passport-btn"
              onClick={handleCopyLink}
              title="Copy link to player card"
            >
              <span>{copied ? '✓' : '📋'}</span>
              <span>{copied ? 'Copied Link!' : 'Share Profile'}</span>
            </button>

            {isOwner ? (
              <button
                type="button"
                className="nx-passport-btn"
                data-primary="true"
                onClick={() => setIsSettingsDrawerOpen(true)}
              >
                <span>⚙️</span>
                <span>Edit Profile</span>
              </button>
            ) : (
              bestGame && (
                <Link
                  to={ROUTES.game(bestGame.slug)}
                  className="nx-passport-btn"
                  data-primary="true"
                  onClick={() => getAchievementBus().unlock('social_gauntlet_thrown')}
                >
                  <span>⚔️</span>
                  <span>Challenge Record</span>
                </Link>
              )
            )}
          </div>
        </div>

        {/* Stat Strip */}
        <div className="nx-passport-stat-strip">
          <div className="nx-passport-stat-cell">
            <span className="nx-passport-stat-label">Times Played</span>
            <div className="nx-passport-stat-value">
              <span>{profile.totalPlays.toLocaleString()}</span>
              <span className="nx-passport-stat-sub">runs</span>
            </div>
          </div>

          <div className="nx-passport-stat-cell">
            <span className="nx-passport-stat-label">Candy Bank</span>
            <div className="nx-passport-stat-value">
              <span>{profile.totalCandy.toLocaleString()}</span>
              <span className="nx-passport-stat-sub">🍬</span>
            </div>
          </div>

          <div className="nx-passport-stat-cell">
            <span className="nx-passport-stat-label">Global Records</span>
            <div className="nx-passport-stat-value">
              <span>{profile.recordsHeld}</span>
              {profile.recordsList.length > 0 && (
                <span className="nx-passport-stat-sub" style={{ color: 'var(--nx-orange-deep)' }}>
                  ({profile.recordsList[0]})
                </span>
              )}
            </div>
          </div>

          <div className="nx-passport-stat-cell">
            <span className="nx-passport-stat-label">Arcade Rating</span>
            <div className="nx-passport-stat-value">
              <span style={{ color: 'var(--nx-green-deep)' }}>{profile.arcadeRating}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ==================================================================
          2. TWO-COLUMN LAYOUT (Showcase vs Social & Badges)
          ================================================================== */}
      <div className="nx-profile-grid">
        {/* Left Column (65%): Competitive Showcase */}
        {(() => {
          const showcasedGames = MANIFESTS.filter((manifest) => {
            const gameStat = profile.games[manifest.slug]
            const userBest = gameStat?.highscore ?? null
            if (userBest === null) return false
            if (manifest.slug === 'fl-tron-3') return userBest > 1000
            return userBest > 0
          }).slice(0, 3)

          return (
            <div className="nx-profile-main-col">
              <div className="nx-profile-section-title">
                <span>Competitive Showcase</span>
                <span className="nx-profile-section-badge">
                  {showcasedGames.length} {showcasedGames.length === 1 ? 'Arcade Title' : 'Arcade Titles'}
                </span>
              </div>

              <div className="nx-showcase-list">
                {showcasedGames.length > 0 ? (
                  showcasedGames.map((manifest) => {
                    const gameStat = profile.games[manifest.slug]
                    const userBest = gameStat?.highscore ?? null
                    const globalRecord = gameStat?.globalHighscore ?? null
                    const plays = gameStat?.plays ?? 0
                    const isRecord = gameStat?.isRecordHolder ?? false
                    const percentile = gameStat?.percentile ?? 'Top 50%'

                    const formattedBest = userBest !== null
                      ? (manifest.formatScore ? manifest.formatScore(userBest) : userBest.toLocaleString())
                      : '—'
                    const formattedGlobal = (globalRecord !== null && (manifest.slug !== 'fl-tron-3' || globalRecord > 1000))
                      ? (manifest.formatScore ? manifest.formatScore(globalRecord) : globalRecord.toLocaleString())
                      : '—'

                    return (
                      <div key={manifest.slug} className="nx-game-showcase-card">
                        <div className="nx-game-card-cover">
                          <img src={manifest.cover} alt={manifest.title} />
                        </div>

                        <div className="nx-game-card-content">
                          <div className="nx-game-card-header">
                            <div className="nx-game-card-title-group">
                              <h3 className="nx-game-card-title">{manifest.title}</h3>
                              <p className="nx-game-card-tagline">{manifest.tagline}</p>
                            </div>

                            {isRecord && (
                              <div className="nx-record-holder-badge">
                                <span>🏆</span>
                                <span>WORLD RECORD</span>
                              </div>
                            )}
                          </div>

                          <div className="nx-game-metrics-row">
                            <div className="nx-metric-block">
                              <span className="nx-metric-label">Personal Best</span>
                              <span className="nx-metric-value">{formattedBest}</span>
                            </div>

                            <div className="nx-metric-block">
                              <span className="nx-metric-label">World Record</span>
                              <span className="nx-metric-value">{formattedGlobal}</span>
                            </div>

                            <div className="nx-metric-percentile">
                              {percentile}
                            </div>
                          </div>

                          <div className="nx-game-card-footer">
                            <span className="nx-game-runs-count">
                              {plays} {plays === 1 ? 'Run Played' : 'Runs Played'}
                            </span>

                            <Link
                              to={ROUTES.game(manifest.slug)}
                              className="nx-game-challenge-btn"
                            >
                              <span>{isOwner ? 'Play Again' : 'Challenge PB'}</span>
                              <span>→</span>
                            </Link>
                          </div>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="nx-showcase-empty">
                    <div className="nx-showcase-empty-icon">🎮</div>
                    <h4 className="nx-showcase-empty-title">No Personal Bests Yet</h4>
                    <p className="nx-showcase-empty-desc">
                      {isOwner
                        ? 'Play games in the arcade and complete runs to establish personal bests and showcase your records here.'
                        : 'This player has not established any personal bests yet.'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )
        })()}

        {/* Right Column (35%): Retention & Social Sidebar */}
        <aside className="nx-social-sidebar">
          {/* A. Activity & Streaks */}
          <div className="nx-sidebar-card">
            <div className="nx-sidebar-card-title">
              <span>Activity & Streaks</span>
              <span>🔥</span>
            </div>

            <div className="nx-streak-header">
              <span className="nx-streak-count">{profile.activeStreak}-Day Active Streak</span>
            </div>

            <div className="nx-streak-matrix">
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, idx) => (
                <div
                  key={idx}
                  className="nx-streak-dot"
                  data-active={profile.streakDays[idx] ? 'true' : undefined}
                >
                  {day}
                </div>
              ))}
            </div>
          </div>

          {/* B. Milestones & Badges Summary (Latest 6) */}
          <div className="nx-sidebar-card">
            <div className="nx-sidebar-card-title">
              <span>Milestones & Badges</span>
              <span className="nx-profile-section-badge">
                {profile.badges.filter((b) => b.unlocked).length} / {profile.badges.length}
              </span>
            </div>

            <div className="nx-badge-list">
              {profile.badges
                .filter((b) => b.unlocked)
                .sort((a, b) => (b.unlockedAt ?? 0) - (a.unlockedAt ?? 0))
                .slice(0, 6)
                .map((badge) => (
                  <div
                    key={badge.id}
                    className="nx-badge-item"
                    data-unlocked="true"
                  >
                    <div className="nx-badge-icon">{badge.icon}</div>
                    <div className="nx-badge-info">
                      <div className="nx-badge-name">
                        <span>{badge.name}</span>
                        <span style={{ color: 'var(--nx-orange)' }}>✓</span>
                      </div>
                      <div className="nx-badge-desc">{badge.description}</div>
                    </div>
                  </div>
                ))}
              {profile.badges.filter((b) => b.unlocked).length === 0 && (
                <div style={{ padding: '12px 0', color: 'var(--nx-slate)', fontSize: '13px', textAlign: 'center', fontFamily: 'var(--nx-font-mono)' }}>
                  No badges unlocked yet. Start playing!
                </div>
              )}
            </div>

            <a
              href="#achievements-showcase"
              className="nx-passport-btn"
              style={{ width: '100%', justifyContent: 'center', marginTop: '12px', fontSize: '12.5px', textDecoration: 'none' }}
            >
              <span>View All 80 Achievements</span>
              <span>↓</span>
            </a>
          </div>

          {/* C. Friends List Preview (Up to 4) */}
          {(!profile.friendsHidden || isOwner) && (
            <div className="nx-sidebar-card">
              <div className="nx-sidebar-card-title">
                <span>Friends</span>
                <span className="nx-profile-section-badge">
                  {profile.friendsCount ?? profile.friends?.length ?? 0}
                </span>
              </div>

              {profile.friends && profile.friends.length > 0 ? (
                <>
                  <div className="nx-friends-sidebar-list">
                    {profile.friends.slice(0, 4).map((friend) => {
                      const hasStaff =
                        hasFlag(friend.flags, UserFlags.STAFF) ||
                        hasFlag(friend.flags, UserFlags.USER_DEVELOPER)
                      const hasPioneer = hasFlag(friend.flags, UserFlags.USER_PIONEER)

                      let statusText = 'Offline'
                      if (friend.presence.state === 'online') {
                        statusText = friend.presence.gameSlug
                          ? `Playing ${friend.presence.gameSlug}`
                          : 'Online'
                      } else if (friend.presence.state === 'idle') {
                        statusText = 'Idle 🌙'
                      }

                      return (
                        <Link
                          key={friend.username}
                          to={ROUTES.userProfile(friend.username)}
                          className="nx-friend-sidebar-item"
                        >
                          <div className="nx-friend-sidebar-avatar">
                            {friend.pfpUrl ? (
                              <img src={friend.pfpUrl} alt={friend.username} />
                            ) : (
                              friend.username.charAt(0).toUpperCase()
                            )}
                            <div
                              className="nx-friend-presence-dot"
                              data-state={friend.presence.state}
                            />
                          </div>

                          <div className="nx-friend-sidebar-info">
                            <div className="nx-friend-sidebar-name">
                              <span>@{friend.username}</span>
                              {hasStaff && <DeveloperBadge size={13} title="Staff" />}
                              {hasPioneer && (
                                <span
                                  title="Pioneer"
                                  style={{
                                    color: 'var(--nx-orange-bright)',
                                    fontSize: '12px',
                                  }}
                                >
                                  ⚡
                                </span>
                              )}
                            </div>
                            <div className="nx-friend-sidebar-status">{statusText}</div>
                          </div>
                        </Link>
                      )
                    })}
                  </div>

                  <Link
                    to={ROUTES.userFriends(profile.username)}
                    className="nx-passport-btn"
                    style={{
                      width: '100%',
                      justifyContent: 'center',
                      marginTop: '12px',
                      fontSize: '12.5px',
                      textDecoration: 'none',
                    }}
                  >
                    <span>See All ({profile.friendsCount ?? profile.friends.length}) Friends</span>
                    <span>→</span>
                  </Link>
                </>
              ) : (
                <div
                  style={{
                    padding: '12px 0',
                    color: 'var(--nx-slate)',
                    fontSize: '13px',
                    textAlign: 'center',
                    fontFamily: 'var(--nx-font-mono)',
                  }}
                >
                  No friends added yet.
                </div>
              )}
            </div>
          )}
        </aside>
      </div>

      {/* Full 80 Achievements & Badges Showcase Section */}
      <section id="achievements-showcase" style={{ marginTop: '40px', scrollMarginTop: '80px' }}>
        <AchievementsShowcase badges={profile.badges} />
      </section>

      {/* Settings Slide-over Drawer for Logged-In Owner */}
      {isOwner && currentUser && (
        <SettingsDrawer
          isOpen={isSettingsDrawerOpen}
          profile={currentUser}
          onClose={() => setIsSettingsDrawerOpen(false)}
          onProfileUpdated={handleProfileUpdated}
        />
      )}
    </div>
  )
}

function formatJoinDate(timestampSeconds: number): string {
  if (!timestampSeconds) return 'Recently'
  const date = new Date(timestampSeconds * 1000)
  const month = date.toLocaleString('default', { month: 'short' })
  const year = date.getFullYear()
  return `${month} ${year}`
}

