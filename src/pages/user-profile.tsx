import { useEffect, useState } from 'react'
import { getPublicProfile, getMe } from '../services/auth-api'
import type { UserPublicProfileResponse, UserProfileResponse } from '../../shared/auth-protocol'
import { MANIFESTS } from '../games/registry'
import { Link } from '../app/link'
import { ROUTES } from '../app/parse-route'
import { SettingsDrawer } from '../components/settings-drawer'
import { AchievementsShowcase } from '../components/achievements/achievements-showcase'
import { DeveloperBadge } from '../components/ui/developer-badge'
import { hasFlag, UserFlags } from '../../shared/flags'
import { getAchievementBus } from '../lib/achievement-bus'
import { readGlobalCandy } from '../services/stats/local-counters'
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
  const localCandy = readGlobalCandy(MANIFESTS.map((m) => m.slug))
  const displayedCandy = isOwner ? Math.max(profile.totalCandy, localCandy) : profile.totalCandy

  // Find best game to challenge
  const bestGame = Object.values(profile.games).reduce((best, curr) => {
    if (!best) return curr
    return (curr.highscore ?? 0) > (best.highscore ?? 0) ? curr : best
  }, Object.values(profile.games)[0])

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
                {(hasFlag(profile.flags, UserFlags.USER_DEVELOPER) || profile.developer) && (
                  <DeveloperBadge size={22} title="Develops games for our Lab." />
                )}
                {(hasFlag(profile.flags, UserFlags.USER_PIONEER) || profile.legacyUser) && (
                  <span className="nx-user-menu-badge" title="Labs Pioneer">
                    <span>⚡</span> Pioneer
                  </span>
                )}
                {profile.nickname && (
                  <span className="nx-passport-nickname">{profile.nickname}</span>
                )}
              </div>

              <div className="nx-passport-submeta">
                {(hasFlag(profile.flags, UserFlags.USER_DEVELOPER) || profile.developer) && (
                  <DeveloperBadge withTag title="Develops games for our Lab." />
                )}
                <span className="nx-passport-title-badge">
                  <span>✨</span> {profile.title}
                </span>
                <span className="nx-passport-bullet">•</span>
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
              <span>{displayedCandy.toLocaleString()}</span>
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
        <div className="nx-profile-main-col">
          <div className="nx-profile-section-title">
            <span>Competitive Showcase</span>
            <span className="nx-profile-section-badge">{MANIFESTS.length} Arcade Titles</span>
          </div>

          <div className="nx-showcase-list">
            {MANIFESTS.map((manifest) => {
              const gameStat = profile.games[manifest.slug]
              const userBest = gameStat?.highscore ?? null
              const globalRecord = gameStat?.globalHighscore ?? null
              const plays = gameStat?.plays ?? 0
              const isRecord = gameStat?.isRecordHolder ?? false
              const percentile = gameStat?.percentile ?? 'Top 50%'

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
                        <span className="nx-metric-value">
                          {userBest !== null ? userBest.toLocaleString() : '—'}
                        </span>
                      </div>

                      <div className="nx-metric-block">
                        <span className="nx-metric-label">World Record</span>
                        <span className="nx-metric-value">
                          {globalRecord !== null ? globalRecord.toLocaleString() : '—'}
                        </span>
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
            })}
          </div>
        </div>

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

          {/* C. Recent Run Ledger */}
          <div className="nx-sidebar-card">
            <div className="nx-sidebar-card-title">
              <span>Recent Activity</span>
              <span>⚡</span>
            </div>

            <div className="nx-activity-list">
              {profile.recentActivity.map((act) => (
                <div key={act.id} className="nx-activity-item">
                  <span className="nx-activity-icon">{act.icon}</span>
                  <div>
                    <div>{act.text}</div>
                    <div className="nx-activity-meta">{act.timeAgo}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
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

