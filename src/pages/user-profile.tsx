import { useEffect, useState } from 'react'
import { getPublicProfile } from '../services/auth-api'
import type { UserProfileResponse } from '../../shared/auth-protocol'

export function UserProfilePage({ username }: { username: string }) {
  const [profile, setProfile] = useState<UserProfileResponse | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    getPublicProfile(username)
      .then((p) => {
        if (p) setProfile(p)
        else setError(true)
      })
      .catch(() => setError(true))
  }, [username])

  if (error) {
    return (
      <div className="nx-page" style={{ padding: '40px var(--nx-gutter)' }}>
        <h2>User not found</h2>
      </div>
    )
  }

  if (!profile) return null

  return (
    <div className="nx-page" style={{ padding: '40px var(--nx-gutter)', minHeight: '60vh' }}>
      <div style={{
        background: 'var(--nx-card)',
        border: 'var(--nx-hairline)',
        borderRadius: 'var(--nx-radius-lg)',
        padding: '32px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px',
        maxWidth: '400px',
        margin: '0 auto',
        boxShadow: 'var(--nx-shadow)'
      }}>
        <div style={{
          width: '128px', height: '128px', borderRadius: '50%', overflow: 'hidden',
          background: 'var(--nx-orange)', color: 'var(--nx-card)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', fontSize: '48px', fontWeight: 'bold'
        }}>
          {profile.pfpUrl ? (
            <img src={profile.pfpUrl} alt={profile.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            profile.username.charAt(0).toUpperCase()
          )}
        </div>
        <h1 style={{ margin: 0, color: 'var(--nx-ink)' }}>@{profile.username}</h1>
        {profile.nickname && <p style={{ margin: 0, color: 'var(--nx-graphite)', fontSize: '18px' }}>{profile.nickname}</p>}
      </div>
    </div>
  )
}
