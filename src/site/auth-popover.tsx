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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred'
      setError(message)
    }
  }

  return (
    <div className="nx-auth-container" ref={ref}>
      {user ? (
        <button
          type="button"
          className="nx-nav-link nx-nav-avatar-btn"
          onClick={() => setIsOpen(!isOpen)}
          aria-label={`User menu for ${user.username}`}
          data-active={isOpen ? 'true' : undefined}
        >
          <div className="nx-nav-avatar-circle">
            {user.pfpUrl ? (
              <img src={user.pfpUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              user.username.charAt(0).toUpperCase()
            )}
          </div>
        </button>
      ) : (
        <button
          type="button"
          className="nx-nav-link"
          onClick={() => setIsOpen(!isOpen)}
          data-active={isOpen ? 'true' : undefined}
        >
          Log in
        </button>
      )}

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 8px)',
            background: 'var(--nx-card)',
            border: 'var(--nx-hairline)',
            borderRadius: 'var(--nx-radius)',
            padding: '16px',
            width: '260px',
            boxShadow: 'var(--nx-shadow-lift)',
            zIndex: 100,
          }}
        >
          {user ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div className="nx-nav-avatar-circle" style={{ width: '36px', height: '36px', fontSize: '15px' }}>
                  {user.pfpUrl ? (
                    <img src={user.pfpUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    user.username.charAt(0).toUpperCase()
                  )}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--nx-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    @{user.username}
                  </div>
                  {user.nickname && (
                    <div style={{ fontSize: '12px', color: 'var(--nx-slate)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {user.nickname}
                    </div>
                  )}
                </div>
              </div>
              <hr style={{ border: 0, borderTop: 'var(--nx-hairline)', margin: '4px 0' }} />
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false)
                  navigate(ROUTES.settings)
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  color: 'var(--nx-ink)',
                  fontSize: '13.5px',
                  padding: '6px 8px',
                  borderRadius: 'var(--nx-radius-sm)',
                  font: 'inherit',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--nx-sand)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                Settings
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false)
                  navigate(ROUTES.userProfile(user.username))
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  color: 'var(--nx-ink)',
                  fontSize: '13.5px',
                  padding: '6px 8px',
                  borderRadius: 'var(--nx-radius-sm)',
                  font: 'inherit',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--nx-sand)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                Public Profile
              </button>
              <hr style={{ border: 0, borderTop: 'var(--nx-hairline)', margin: '4px 0' }} />
              <button
                type="button"
                onClick={() => {
                  void logout()
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  color: 'var(--nx-red)',
                  fontSize: '13.5px',
                  padding: '6px 8px',
                  borderRadius: 'var(--nx-radius-sm)',
                  font: 'inherit',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--nx-sand)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                Log out
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--nx-ink)' }}>
                {mode === 'login' ? 'Log in' : 'Create Account'}
              </div>
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                style={{
                  padding: '7px 10px',
                  borderRadius: 'var(--nx-radius-sm)',
                  border: 'var(--nx-hairline)',
                  background: 'var(--nx-paper)',
                  color: 'var(--nx-ink)',
                  fontSize: '13px',
                  outline: 'none',
                }}
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  padding: '7px 10px',
                  borderRadius: 'var(--nx-radius-sm)',
                  border: 'var(--nx-hairline)',
                  background: 'var(--nx-paper)',
                  color: 'var(--nx-ink)',
                  fontSize: '13px',
                  outline: 'none',
                }}
                required
              />
              {error && <div style={{ color: 'var(--nx-red)', fontSize: '12px' }}>{error}</div>}
              <button
                type="submit"
                style={{
                  padding: '7px 12px',
                  borderRadius: 'var(--nx-radius-sm)',
                  border: 'none',
                  background: 'var(--nx-orange)',
                  color: 'var(--nx-card)',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'opacity var(--nx-duration) var(--nx-ease)',
                }}
              >
                {mode === 'login' ? 'Log in' : 'Sign up'}
              </button>
              <div style={{ fontSize: '12px', textAlign: 'center', marginTop: '4px', color: 'var(--nx-slate)' }}>
                {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
                <button
                  type="button"
                  onClick={() => {
                    setMode(mode === 'login' ? 'register' : 'login')
                    setError('')
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--nx-orange)',
                    cursor: 'pointer',
                    padding: 0,
                    fontSize: '12px',
                    fontWeight: 500,
                  }}
                >
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
