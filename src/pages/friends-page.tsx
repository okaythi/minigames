import { useEffect, useState } from 'react'
import { getFriends } from '../services/social-api'
import type { FriendSummary } from '../../shared/auth-protocol'
import { hasFlag, UserFlags } from '../../shared/flags'
import { DeveloperBadge } from '../components/ui/developer-badge'
import { Link } from '../app/link'
import { ROUTES } from '../app/parse-route'
import { useRouter } from '../app/router'
import './friends-page.css'

interface UserFriendsPageProps {
  readonly username: string
}

export function UserFriendsPage({ username }: UserFriendsPageProps) {
  const { navigate } = useRouter()
  const [friends, setFriends] = useState<FriendSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    getFriends(username)
      .then((res) => {
        if (cancelled) return
        if (res.hidden) {
          navigate(ROUTES.userProfile(username))
          return
        }
        setFriends(res.friends || [])
      })
      .catch(() => {
        if (!cancelled) {
          navigate(ROUTES.userProfile(username))
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [username, navigate])

  if (loading) {
    return (
      <div className="nx-friends-page">
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--nx-slate)' }}>
          Loading friends...
        </div>
      </div>
    )
  }

  return (
    <div className="nx-friends-page">
      <header className="nx-friends-header">
        <div className="nx-friends-title-group">
          <Link to={ROUTES.userProfile(username)} className="nx-back" style={{ marginRight: '8px' }}>
            ← Back
          </Link>
          <h1 className="nx-friends-title">@{username}'s Friends</h1>
          <span className="nx-friends-count-pill">{friends.length}</span>
        </div>
      </header>

      {friends.length === 0 ? (
        <div className="nx-friends-empty">
          <p>No friends found.</p>
        </div>
      ) : (
        <div className="nx-friends-grid">
          {friends.map((friend) => {
            const hasStaff = hasFlag(friend.flags, UserFlags.STAFF) || hasFlag(friend.flags, UserFlags.USER_DEVELOPER)
            const hasPioneer = hasFlag(friend.flags, UserFlags.USER_PIONEER)

            return (
              <Link
                key={friend.username}
                to={ROUTES.userProfile(friend.username)}
                className="nx-friend-card"
              >
                <div className="nx-friend-avatar-wrapper">
                  {friend.pfpUrl ? (
                    <img src={friend.pfpUrl} alt={friend.username} className="nx-friend-avatar-img" />
                  ) : (
                    friend.username.charAt(0).toUpperCase()
                  )}
                  <div className="nx-friend-presence-dot" data-state={friend.presence.state} />
                </div>

                <div className="nx-friend-info">
                  <div className="nx-friend-handle-row">
                    <span className="nx-friend-handle">@{friend.username}</span>
                    {hasStaff && <DeveloperBadge size={14} title="Staff" />}
                    {hasPioneer && <span title="Pioneer" style={{ color: 'var(--nx-orange-bright)', fontSize: '13px' }}>⚡</span>}
                  </div>
                  {friend.nickname && (
                    <span className="nx-friend-nickname">{friend.nickname}</span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
