import { useState, useEffect } from 'react'
import { SESSION_REVOKED_EVENT } from '../../services/auth-api'
import './session-revoked-modal.css'

export function SessionRevokedModal() {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const handleRevoked = () => {
      setIsOpen(true)
    }

    window.addEventListener(SESSION_REVOKED_EVENT, handleRevoked)
    return () => {
      window.removeEventListener(SESSION_REVOKED_EVENT, handleRevoked)
    }
  }, [])

  const handleOk = () => {
    setIsOpen(false)
    // If currently on an admin page, navigate to home
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) {
      window.location.href = '/'
      return
    }
    // Open auth popover to prompt user to log in again
    window.dispatchEvent(new CustomEvent('nx:open-auth'))
  }

  if (!isOpen) return null

  return (
    <div
      className="nx-session-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-modal-title"
    >
      <div className="nx-session-modal-card">
        <div className="nx-session-modal-header">
          <h3 id="session-modal-title" className="nx-session-modal-title">
            Session Expired
          </h3>
        </div>
        <div className="nx-session-modal-body">
          You must log in again.
        </div>
        <div className="nx-session-modal-footer">
          <button
            type="button"
            className="nx-session-modal-btn"
            onClick={handleOk}
            autoFocus
          >
            Ok
          </button>
        </div>
      </div>
    </div>
  )
}
