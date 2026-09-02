import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { getMe, updateNickname, updatePfp } from '../services/auth-api'
import type { UserProfileResponse } from '../../shared/auth-protocol'
import { useRouter } from '../app/router'
import { ROUTES } from '../app/parse-route'

export function SettingsPage() {
  const [profile, setProfile] = useState<UserProfileResponse | null>(null)
  const [nickname, setNickname] = useState('')
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const { navigate } = useRouter()

  useEffect(() => {
    getMe().then(p => {
      if (!p) {
        navigate(ROUTES.home)
      } else {
        setProfile(p)
      }
    })
  }, [navigate])

  const handleNickname = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setMsg('')
    try {
      await updateNickname({ nickname })
      setMsg('Nickname updated successfully!')
      setProfile(prev => prev ? { ...prev, nickname } : null)
    } catch (err: any) {
      setError(err.message || 'Error updating nickname (you can only change it once).')
    }
  }

  const handlePfp = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setMsg('')
    try {
      const res = await updatePfp(file)
      setProfile(prev => prev ? { ...prev, pfpUrl: res.pfpUrl } : null)
      setMsg('Profile picture updated!')
    } catch (err: any) {
      setError(err.message || 'Error uploading profile picture.')
    }
  }

  if (!profile) return null

  return (
    <div className="nx-page" style={{ padding: '40px var(--nx-gutter)', minHeight: '60vh' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <h1 style={{ color: 'var(--nx-ink)' }}>Settings</h1>
        <div style={{
          background: 'var(--nx-card)',
          border: 'var(--nx-hairline)',
          borderRadius: 'var(--nx-radius-lg)',
          padding: '32px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          boxShadow: 'var(--nx-shadow-sm)'
        }}>
          <div>
            <h3 style={{ margin: '0 0 16px', color: 'var(--nx-ink)' }}>Profile Picture</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                width: '64px', height: '64px', borderRadius: '50%', overflow: 'hidden',
                background: 'var(--nx-orange)', color: 'var(--nx-card)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 'bold'
              }}>
                {profile.pfpUrl ? (
                  <img src={profile.pfpUrl} alt={profile.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  profile.username.charAt(0).toUpperCase()
                )}
              </div>
              <input type="file" accept="image/png, image/jpeg, image/gif" onChange={handlePfp} />
            </div>
          </div>

          <hr style={{ border: 0, borderTop: 'var(--nx-hairline)' }} />

          <form onSubmit={handleNickname}>
            <h3 style={{ margin: '0 0 16px', color: 'var(--nx-ink)' }}>Change Nickname (One-time)</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder={profile.nickname || 'New Nickname'}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                style={{
                  padding: '8px 12px', borderRadius: 'var(--nx-radius-sm)', border: 'var(--nx-hairline)',
                  background: 'var(--nx-paper)', color: 'var(--nx-ink)', flex: 1, outline: 'none'
                }}
                required
                minLength={1}
                maxLength={50}
              />
              <button type="submit" style={{
                padding: '8px 16px', borderRadius: 'var(--nx-radius-sm)', border: 'none',
                background: 'var(--nx-orange)', color: 'var(--nx-card)', fontWeight: 600, cursor: 'pointer'
              }}>
                Save
              </button>
            </div>
          </form>

          {error && <div style={{ color: 'var(--nx-red)', fontWeight: 500 }}>{error}</div>}
          {msg && <div style={{ color: 'var(--nx-green)', fontWeight: 500 }}>{msg}</div>}
        </div>
      </div>
    </div>
  )
}
