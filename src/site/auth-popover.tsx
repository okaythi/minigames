import { useState, useEffect, useRef, type FormEvent } from 'react'
import { login, register, logout, getMe } from '../services/auth-api'
import type { UserProfileResponse } from '../../shared/auth-protocol'
import { useRouter } from '../app/router'
import { ROUTES } from '../app/parse-route'

export function AuthPopover() {
  const [isOpen, setIsOpen] = useState(false)
  const [user, setUser] = useState<UserProfileResponse | null>(null)
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const { navigate } = useRouter()

  useEffect(() => {
    getMe().then(setUser)
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      if (mode === 'login') {
        await login({ username, password })
      } else {
        await register({ username, password })
      }
      const me = await getMe()
      setUser(me)
      setIsOpen(false)
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    }
  }

  return (
    <div className="auth-popover-container" ref={ref} style={{ position: 'relative' }}>
      <button 
        className="auth-toggle" 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '4px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}
      >
        {user ? (
          <div style={{
            width: '32px', height: '32px', borderRadius: '50%', overflow: 'hidden', 
            background: 'var(--nx-orange-deep)', color: 'white', display: 'flex', 
            alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 'bold'
          }}>
            {user.pfpUrl ? <img src={user.pfpUrl} alt="pfp" style={{width: '100%', height: '100%', objectFit: 'cover'}} /> : user.username.charAt(0).toUpperCase()}
          </div>
        ) : (
          <span style={{ color: 'var(--nx-ink)', fontWeight: 500 }}>Log in</span>
        )}
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute', right: 0, top: '40px', background: 'var(--nx-card)', 
          border: 'var(--nx-hairline)', borderRadius: 'var(--nx-radius)', padding: '16px', 
          width: '240px', boxShadow: 'var(--nx-shadow-lift)', zIndex: 100
        }}>
          {user ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--nx-ink)' }}>@{user.username}</div>
              {user.nickname && <div style={{ fontSize: '14px', color: 'var(--nx-slate)' }}>{user.nickname}</div>}
              <hr style={{ border: 0, borderTop: 'var(--nx-hairline)' }} />
              <button onClick={() => { setIsOpen(false); navigate(ROUTES.settings) }} style={{
                background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer', color: 'var(--nx-ink)'
              }}>Settings</button>
              <button onClick={() => { setIsOpen(false); navigate(ROUTES.userProfile(user.username)) }} style={{
                background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer', color: 'var(--nx-ink)'
              }}>Public Profile</button>
              <button onClick={logout} style={{
                background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer', color: 'var(--nx-red)'
              }}>Log out</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--nx-ink)', marginBottom: '8px' }}>
                {mode === 'login' ? 'Log in' : 'Create Account'}
              </div>
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={e => setUsername(e.target.value.toLowerCase())}
                style={{
                  padding: '8px', borderRadius: 'var(--nx-radius-sm)', border: 'var(--nx-hairline)',
                  background: 'var(--nx-paper)', color: 'var(--nx-ink)', outline: 'none'
                }}
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{
                  padding: '8px', borderRadius: 'var(--nx-radius-sm)', border: 'var(--nx-hairline)',
                  background: 'var(--nx-paper)', color: 'var(--nx-ink)', outline: 'none'
                }}
                required
              />
              {error && <div style={{ color: 'var(--nx-red)', fontSize: '12px' }}>{error}</div>}
              <button type="submit" style={{
                padding: '8px', borderRadius: 'var(--nx-radius-sm)', border: 'none',
                background: 'var(--nx-orange)', color: 'var(--nx-card)', fontWeight: 600, cursor: 'pointer'
              }}>
                {mode === 'login' ? 'Log in' : 'Sign up'}
              </button>
              <div style={{ fontSize: '12px', textAlign: 'center', marginTop: '8px', color: 'var(--nx-slate)' }}>
                {mode === 'login' ? "Don't have an account? " : "Already have an account? "}
                <button type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }} style={{
                  background: 'none', border: 'none', color: 'var(--nx-orange)', cursor: 'pointer', padding: 0
                }}>
                  {mode === 'login' ? 'Sign up' : 'Log in'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
