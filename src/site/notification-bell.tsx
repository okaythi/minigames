import { useState, useRef, useEffect } from 'react'
import {
  useNotifications,
  acceptFriendRequest,
  declineFriendRequest,
  dismissMessageNotification,
} from '../services/notifications-service'
import { openChat } from '../services/social-api'
import { getCurrentUser } from '../services/auth-api'
import './notification-bell.css'

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const currentUser = getCurrentUser()
  const { friendRequests, messageNotifications, totalCount } = useNotifications()

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  // Bell is visible when user is logged in
  if (!currentUser) {
    return null
  }

  const handleAccept = async (username: string) => {
    setActionLoading(username)
    try {
      await acceptFriendRequest(username)
    } finally {
      setActionLoading(null)
    }
  }

  const handleDeny = async (username: string) => {
    setActionLoading(username)
    try {
      await declineFriendRequest(username)
    } finally {
      setActionLoading(null)
    }
  }

  const handleOpenMessage = (username: string) => {
    dismissMessageNotification(username)
    setIsOpen(false)
    openChat(username)
  }

  return (
    <div className="nx-notif-bell-container" ref={containerRef}>
      <button
        type="button"
        className="nx-notif-bell-btn"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`Notifications${totalCount > 0 ? ` (${totalCount} unread)` : ''}`}
        aria-expanded={isOpen}
      >
        <svg
          className="nx-notif-bell-icon"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--nx-orange)"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>

        {totalCount > 0 && (
          <span className="nx-notif-badge" aria-hidden="true">
            {totalCount > 99 ? '99+' : totalCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="nx-notif-dropdown" role="region" aria-label="Notifications list">
          <div className="nx-notif-dropdown-header">
            <span className="nx-notif-dropdown-title">Notifications</span>
            {totalCount > 0 && (
              <span className="nx-notif-dropdown-count">{totalCount} new</span>
            )}
          </div>

          <div className="nx-notif-list">
            {totalCount === 0 ? (
              <div className="nx-notif-empty">No notifications at the moment.</div>
            ) : (
              <>
                {friendRequests.map((f) => (
                  <div key={`fr_${f.username}`} className="nx-notif-item nx-notif-friend-req">
                    <div className="nx-notif-avatar">
                      {f.pfpUrl ? (
                        <img src={f.pfpUrl} alt={f.username} />
                      ) : (
                        <span>{f.username.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="nx-notif-body">
                      <div className="nx-notif-text">
                        <strong className="nx-notif-username">@{f.username}</strong> sent you a friend request!
                      </div>
                      <div className="nx-notif-actions">
                        <button
                          type="button"
                          className="nx-notif-btn nx-notif-btn-accept"
                          disabled={actionLoading === f.username}
                          onClick={() => handleAccept(f.username)}
                        >
                          accept
                        </button>
                        <button
                          type="button"
                          className="nx-notif-btn nx-notif-btn-deny"
                          disabled={actionLoading === f.username}
                          onClick={() => handleDeny(f.username)}
                        >
                          deny
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {messageNotifications.map((m) => (
                  <button
                    key={`msg_${m.username}`}
                    type="button"
                    className="nx-notif-item nx-notif-msg"
                    onClick={() => handleOpenMessage(m.username)}
                  >
                    <div className="nx-notif-avatar">
                      {m.pfpUrl ? (
                        <img src={m.pfpUrl} alt={m.username} />
                      ) : (
                        <span>{m.username.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="nx-notif-body">
                      <div className="nx-notif-text">
                        <strong className="nx-notif-username">@{m.username}</strong> sent you a message!
                      </div>
                      {m.lastMessageSnippet && (
                        <div className="nx-notif-snippet">"{m.lastMessageSnippet}"</div>
                      )}
                    </div>
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
