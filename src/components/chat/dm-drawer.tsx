import { useEffect, useRef, useState } from 'react'
import { getMyFriends } from '../../services/social-api'
import { useChatController } from '../../engine/chat'
import { getCurrentUser } from '../../services/auth-api'
import type { FriendSummary } from '../../../shared/auth-protocol'
import { MANIFESTS } from '../../games/registry'
import { Link } from '../../app/link'
import { ROUTES } from '../../app/parse-route'
import { ChatMessageItem } from './chat-message-item'
import { ChatDisclaimer } from './chat-disclaimer'
import { CustomChallengePanel } from './custom-challenge-panel'
import { ConversationCard } from './conversation-card'
import './dm-drawer.css'

/**
 * Presentational shell for the chat engine. This file renders snapshots and
 * dispatches intents; it owns no data fetching, no timers, no send logic and
 * no error handling policy — all of that lives in `src/engine/chat`.
 */
export function DmDrawer() {
  const { snapshot, active, actions } = useChatController()
  const [friends, setFriends] = useState<readonly FriendSummary[]>([])
  const [showChallengeModal, setShowChallengeModal] = useState(false)
  const [selectedGame, setSelectedGame] = useState(MANIFESTS[0]?.slug ?? 'avoid-the-spikes')
  const [targetScore, setTargetScore] = useState(100)
  const [bountyCandy, setBountyCandy] = useState(0)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const currentUser = getCurrentUser()

  const isOpen = snapshot.panelOpen

  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        panelRef.current &&
        !panelRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        actions.closePanel()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, actions])

  // Deep-link open from profiles / the bell: "chat with X".
  useEffect(() => {
    const handleOpenChat = (e: Event) => {
      const detail = (e as CustomEvent<{ username?: string }>).detail
      actions.openPanel()
      if (typeof detail?.username === 'string') {
        actions.selectConversation(detail.username)
      }
    }
    window.addEventListener('nx-open-chat', handleOpenChat)
    return () => window.removeEventListener('nx-open-chat', handleOpenChat)
  }, [actions])

  // The friend picker section is social-domain data; the engine does not own
  // it. getMyFriends is shared + single-flight, so opening the drawer right
  // after a notifications refresh is free.
  useEffect(() => {
    if (!isOpen || !currentUser) return
    let cancelled = false
    void getMyFriends().then((res) => {
      if (!cancelled) setFriends(res.friends ?? [])
    })
    return () => {
      cancelled = true
    }
  }, [isOpen, currentUser])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [snapshot.revision])

  if (!currentUser) return null

  const selectConversation = (username: string): void => {
    setShowChallengeModal(false)
    actions.selectConversation(username)
  }

  const handleSend = (): void => {
    if (active === null) return
    const text = active.draft.trim()
    if (text.length === 0) return
    actions.send(active.partner, text)
  }

  const handleSendChallenge = (): void => {
    if (active === null) return
    setShowChallengeModal(false)
    const manifest = MANIFESTS.find((m) => m.slug === selectedGame)
    const title = manifest?.title ?? selectedGame
    const content = `⚔️ Challenge: Beat my score of ${targetScore} in ${title}!`
    actions.sendChallenge(active.partner, content, {
      gameSlug: selectedGame,
      targetScore,
      bountyCandy,
    })
  }

  const totalUnread = snapshot.totalUnread

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`nx-chat-trigger ${totalUnread > 0 ? 'nx-has-unread' : ''}`}
        onClick={() => (isOpen ? actions.closePanel() : actions.openPanel())}
        aria-label="Open messages"
      >
        <span className="nx-chat-trigger-icon-wrap">
          <span>💬</span>
          {totalUnread > 0 && (
            <span className="nx-chat-tray-badge" aria-label={`${totalUnread} unread messages`}>
              {totalUnread > 99 ? '99+' : totalUnread}
            </span>
          )}
        </span>
        <span>Chat</span>
      </button>

      {isOpen && (
        <aside ref={panelRef} className="nx-chat-panel" aria-label="Direct messages panel">
          <header className="nx-chat-header">
            {active !== null ? (
              <div className="nx-chat-partner">
                <button
                  type="button"
                  className="nx-chat-back-btn"
                  onClick={() => actions.selectConversation(null)}
                  aria-label="Back to messages list"
                >
                  ←
                </button>
                <Link
                  to={ROUTES.userProfile(active.partner)}
                  className="nx-chat-header-avatar nx-chat-header-avatar-link"
                  title={`View @${active.partner}'s profile`}
                >
                  {active.pfpUrl ? (
                    <img src={active.pfpUrl} alt={active.partner} />
                  ) : (
                    <span>{active.partner.charAt(0).toUpperCase()}</span>
                  )}
                </Link>
                <span className="nx-chat-header-username">@{active.partner}</span>
              </div>
            ) : (
              <strong className="nx-chat-header-title">Messages</strong>
            )}
            <button
              type="button"
              className="nx-chat-close-btn"
              onClick={actions.closePanel}
              aria-label="Close chat"
            >
              ✕
            </button>
          </header>

          {active === null ? (
            <div className="nx-chat-convo-list">
              {snapshot.conversations.length > 0 ? (
                <>
                  <div className="nx-chat-section-title">Recent Conversations</div>
                  {snapshot.conversations.map((c) => (
                    <ConversationCard
                      key={c.key}
                      conversation={c}
                      onClick={() => selectConversation(c.partner)}
                    />
                  ))}
                </>
              ) : (
                <div className="nx-chat-empty-state">
                  <span className="nx-chat-empty-icon">✉️</span>
                  <p className="nx-chat-empty-text">
                    No messages yet. Pick a friend below to start chatting!
                  </p>
                </div>
              )}

              {friends.length > 0 && (
                <>
                  <div className="nx-chat-section-title">Friends</div>
                  {friends.map((f) => (
                    <button
                      key={f.username}
                      type="button"
                      className="nx-chat-friend-item"
                      onClick={() => selectConversation(f.username)}
                    >
                      <div className="nx-friend-sidebar-avatar">
                        {f.pfpUrl ? (
                          <img src={f.pfpUrl} alt={f.username} />
                        ) : (
                          f.username.charAt(0).toUpperCase()
                        )}
                        <div className="nx-friend-presence-dot" data-state={f.presence.state} />
                      </div>
                      <div className="nx-chat-friend-details">
                        <span className="nx-chat-friend-username">@{f.username}</span>
                        {f.nickname && <span className="nx-chat-friend-nickname">{f.nickname}</span>}
                      </div>
                    </button>
                  ))}
                </>
              )}
            </div>
          ) : (
            <>
              <div className="nx-chat-body">
                {active.status === 'loading' && (
                  <div className="nx-chat-loading">loading messages…</div>
                )}
                {active.status === 'error' && (
                  <div className="nx-chat-load-error" role="alert">
                    {active.loadError ?? 'Could not load this conversation — retrying in the background.'}
                  </div>
                )}
                {active.messages.map((view) => {
                  const isMe =
                    view.wire !== null &&
                    view.wire.senderUsername.toLowerCase() === currentUser.username.toLowerCase()
                  const envelopeId = view.outbound?.clientMessageId
                  return (
                    <ChatMessageItem
                      key={view.id}
                      view={view}
                      isMe={isMe}
                      onPlayChallenge={() => setShowChallengeModal(false)}
                      {...(envelopeId !== undefined
                        ? {
                            onRetry: () => actions.retry(envelopeId),
                            onResend: () => actions.resend(envelopeId),
                            onDismiss: () => actions.dismissEnvelope(envelopeId),
                          }
                        : {})}
                    />
                  )
                })}
                <div ref={messagesEndRef} />
              </div>

              {active.banner !== null && (
                <div className="nx-chat-banner" role="alert">
                  <span className="nx-chat-banner-text">⚠️ {active.banner.text}</span>
                  <button
                    type="button"
                    className="nx-chat-banner-close"
                    onClick={() => actions.dismissBanner(active?.partner ?? '')}
                    aria-label="Dismiss notice"
                  >
                    ✕
                  </button>
                </div>
              )}

              {active.cooldownSecondsLeft > 0 && (
                <div className="nx-chat-queue-indicator">
                  ⏱️ Rate limit cooldown: {active.cooldownSecondsLeft}s
                  {active.queuedCount > 0 ? ` (${active.queuedCount} queued)` : ''}
                </div>
              )}

              <ChatDisclaimer recipientUsername={active.partner} />

              {showChallengeModal && (
                <CustomChallengePanel
                  selectedGame={selectedGame}
                  onSelectGame={setSelectedGame}
                  targetScore={targetScore}
                  onChangeTargetScore={setTargetScore}
                  bountyCandy={bountyCandy}
                  onChangeBountyCandy={setBountyCandy}
                  onSendChallenge={handleSendChallenge}
                  onClose={() => setShowChallengeModal(false)}
                />
              )}

              <footer className="nx-chat-input-bar">
                <button
                  type="button"
                  className={`nx-chat-challenge-toggle-btn ${showChallengeModal ? 'nx-active' : ''}`}
                  title="Challenge Friend"
                  aria-label="Challenge Friend"
                  onClick={() => setShowChallengeModal(!showChallengeModal)}
                >
                  ⚔️
                </button>
                <input
                  type="text"
                  className="nx-chat-input"
                  placeholder="Type a message..."
                  value={active.draft}
                  onChange={(e) => actions.setDraft(active.partner, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSend()
                  }}
                  maxLength={500}
                />
                <button type="button" className="nx-chat-send-btn" onClick={handleSend}>
                  Send
                </button>
              </footer>
            </>
          )}
        </aside>
      )}
    </>
  )
}

