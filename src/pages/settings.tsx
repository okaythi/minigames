import { useEffect, useState } from 'react'
import { getMe } from '../services/auth-api'
import type { UserProfileResponse } from '../../shared/auth-protocol'
import { useRouter } from '../app/router'
import { ROUTES } from '../app/parse-route'
import { SettingsContent } from '../components/settings-content'
import { Link } from '../app/link'
import './settings.css'

export function SettingsPage() {
  const [profile, setProfile] = useState<UserProfileResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const { navigate } = useRouter()

  useEffect(() => {
    getMe().then((p) => {
      if (!p) {
        navigate(ROUTES.home)
      } else {
        setProfile(p)
      }
      setLoading(false)
    })
  }, [navigate])

  if (loading) {
    return (
      <div className="nx-page" style={{ padding: '60px var(--nx-gutter)', textAlign: 'center' }}>
        <div style={{ color: 'var(--nx-slate)', fontFamily: 'var(--nx-font-mono)', fontSize: '13px' }}>
          Loading profile settings...
        </div>
      </div>
    )
  }

  if (!profile) return null

  return (
    <div className="nx-settings-container">
      <div className="nx-settings-header">
        <div style={{ marginBottom: '12px' }}>
          <Link
            to={ROUTES.userProfile(profile.username)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: 'var(--nx-orange-deep)',
              fontSize: '13px',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            <span>←</span> Back to @{profile.username}'s Profile
          </Link>
        </div>
        <h1 className="nx-settings-title">Settings</h1>
        <p className="nx-settings-subtitle">Customize your avatar and arcade display identity.</p>
      </div>

      <SettingsContent profile={profile} onProfileUpdated={setProfile} />
    </div>
  )
}

