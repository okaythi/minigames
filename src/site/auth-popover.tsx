import { useState, useEffect, useRef, type FormEvent } from 'react'
import { login, register, logout, getMe } from '../services/auth-api'
import type { UserProfileResponse } from '../../shared/auth-protocol'
import { useRouter } from '../app/router'
import { ROUTES } from '../app/parse-route'
import { DeveloperBadge } from '../components/ui/developer-badge'
import './auth-popover.css'

export function AuthPopover() {
  const [isOpen, setIsOpen] = useState(false)
  const [user, setUser] = useState<UserProfileResponse | null>(null)
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { navigate } = useRouter()

  useEffect(() => {
    void getMe().then(setUser)
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    const cleanUsername = username.trim().toLowerCase()
    if (cleanUsername.length < 3) {
      setError('Username must be at least 3 characters.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setSubmitting(true)
    try {
      if (mode === 'login') {
        await login({ username: cleanUsername, password })
      } else {
        await register({ username: cleanUsername, password })
      }
      const me = await getMe()
      setUser(me)
      setIsOpen(false)
      setUsername('')
      setPassword('')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred'
      setError(message)
    } finally {
      setSubmitting(false)
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
          Sign in
        </button>
      )}

      {isOpen && (
        <div className="nx-auth-popover" role="dialog" aria-modal="true">
          {user ? (
            <div>
              <div className="nx-user-menu-header">
                <div className="nx-user-menu-avatar">
                  {user.pfpUrl ? (
                    <img src={user.pfpUrl} alt="" />
                  ) : (
                    user.username.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="nx-user-menu-meta">
                  <div className="nx-user-menu-username" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>@{user.username}</span>
                    {user.developer && <DeveloperBadge size={16} title="Develops games for our Lab." />}
                  </div>
                  {user.nickname && <div className="nx-user-menu-nickname">{user.nickname}</div>}
                  {user.legacyUser && (
                    <span className="nx-user-menu-badge">
                      <span>⚡</span> Pioneer
                    </span>
                  )}
                </div>
              </div>

              <div className="nx-user-menu-nav">
                <button
                  type="button"
                  className="nx-user-menu-item"
                  onClick={() => {
                    setIsOpen(false)
                    navigate(ROUTES.userProfile(user.username))
                  }}
                >
                  <span className="nx-user-menu-item-icon">👤</span>
                  <span>My Profile</span>
                </button>

                <button
                  type="button"
                  className="nx-user-menu-item"
                  onClick={() => {
                    setIsOpen(false)
                    navigate(ROUTES.settings)
                  }}
                >
                  <span className="nx-user-menu-item-icon">⚙️</span>
                  <span>Settings & Avatar</span>
                </button>
              </div>

              <hr className="nx-user-menu-divider" />

              <div style={{ paddingTop: '4px' }}>
                <button
                  type="button"
                  className="nx-user-menu-item"
                  data-danger="true"
                  onClick={() => {
                    void logout()
                  }}
                >
                  <span className="nx-user-menu-item-icon">🚪</span>
                  <span>Log out</span>
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="nx-auth-tabs">
                <button
                  type="button"
                  className="nx-auth-tab"
                  data-active={mode === 'login' ? 'true' : undefined}
                  onClick={() => {
                    setMode('login')
                    setError('')
                  }}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  className="nx-auth-tab"
                  data-active={mode === 'register' ? 'true' : undefined}
                  onClick={() => {
                    setMode('register')
                    setError('')
                  }}
                >
                  Create Account
                </button>
              </div>

              <form onSubmit={handleSubmit} className="nx-auth-form">
                <div className="nx-auth-field">
                  <label className="nx-auth-label" htmlFor="nx-auth-username">
                    Username
                  </label>
                  <input
                    id="nx-auth-username"
                    className="nx-auth-input"
                    type="text"
                    placeholder="e.g. arcade_champ"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase())}
                    autoComplete="username"
                    required
                    minLength={3}
                    maxLength={30}
                  />
                  {mode === 'register' && (
                    <span className="nx-auth-hint">3-30 letters, numbers, underscores or dots.</span>
                  )}
                </div>

                <div className="nx-auth-field">
                  <label className="nx-auth-label" htmlFor="nx-auth-password">
                    Password
                  </label>
                  <input
                    id="nx-auth-password"
                    className="nx-auth-input"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    required
                    minLength={8}
                    maxLength={100}
                  />
                  {mode === 'register' && (
                    <span className="nx-auth-hint">Must be at least 8 characters.</span>
                  )}
                </div>

                {error && <div className="nx-auth-error">{error}</div>}

                <button
                  type="submit"
                  className="nx-auth-submit"
                  disabled={submitting}
                >
                  {submitting
                    ? 'Please wait...'
                    : mode === 'login'
                    ? 'Sign in to Arcade'
                    : 'Create Account'}
                </button>

                <div className="nx-auth-switch">
                  {mode === 'login' ? "Don't have an account? " : 'Already registered? '}
                  <button
                    type="button"
                    className="nx-auth-switch-btn"
                    onClick={() => {
                      setMode(mode === 'login' ? 'register' : 'login')
                      setError('')
                    }}
                  >
                    {mode === 'login' ? 'Sign up' : 'Sign in'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

