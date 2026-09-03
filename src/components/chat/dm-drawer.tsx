import { useState, useEffect, useRef } from 'react'
import { getCurrentUser } from '../../services/auth-api'
import {
  getConversations,
  getMessages,
  sendMessage,
  getMyFriends,
} from '../../services/social-api'
import type { DirectMessage, FriendSummary, ConversationSummary } from '../../../shared/auth-protocol'
import { MANIFESTS } from '../../games/registry'
import { Link } from '../../app/link'
import { ROUTES } from '../../app/parse-route'
import { ChatMessageItem } from './chat-message-item'
import { ChatDisclaimer } from './chat-disclaimer'
import { CustomChallengePanel } from './custom-challenge-panel'
import { ConversationCard } from './conversation-card'
import './dm-drawer.css'

export function DmDrawer() {
  const [isOpen, setIsOpen] = useState(false)
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [activePartner, setActivePartner] = useState<string | null>(null)
  const [messages, setMessages] = useState<DirectMessage[]>([])
  const [inputVal, setInputVal] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const [queue, setQueue] = useState<string[]>([])
  const [showChallengeModal, setShowChallengeModal] = useState(false)
  const [selectedGame, setSelectedGame] = useState(MANIFESTS[0]?.slug ?? 'avoid-the-spikes')
  const [targetScore, setTargetScore] = useState(100)
  const [bountyCandy, setBountyCandy] = useState(0)
  const [friends, setFriends] = useState<FriendSummary[]>([])

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const currentUser = getCurrentUser()

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
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  useEffect(() => {
    const handleOpenChat = (e: any) => {
      setIsOpen(true)
      if (e.detail?.username) {
        handleSelectPartner(e.detail.username)
      }
    }
    window.addEventListener('nx-open-chat', handleOpenChat)
    return () => window.removeEventListener('nx-open-chat', handleOpenChat)
  }, [])

  useEffect(() => {
    if (!isOpen || !currentUser) return
    getConversations().then(setConversations)
    getMyFriends().then((res) => setFriends(res.friends || []))
  }, [isOpen, currentUser])

  useEffect(() => {
    if (!activePartner) return
    let active = true
    const poll = () => {
      getMessages(activePartner).then((incomingMsgs) => {
        if (!active) return
        setMessages((currentMsgs) => {
          // Retain pending sending messages and local failed/error messages that aren't on server
          const localOnly = currentMsgs.filter(
            (m) => (m.status === 'sending' || m.failed) && !incomingMsgs.some((im) => im.id === m.id),
          )
          const mappedIncoming = incomingMsgs.map((m) => ({
            ...m,
            status: m.status ?? ('sent' as const),
          }))
          return [...mappedIncoming, ...localOnly]
        })
      })
    }
    poll()
    const timer = setInterval(poll, 3000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [activePartner])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setInterval(() => {
      setCooldown((c) => Math.max(0, c - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  // Process message queue when cooldown reaches 0
  useEffect(() => {
    if (cooldown === 0 && queue.length > 0 && activePartner) {
      const nextMsg = queue[0]
      if (!nextMsg) return
      setQueue((q) => q.slice(1))
      void dispatchSendMessage(nextMsg)
    }
  }, [cooldown, queue, activePartner])

  const handleSelectPartner = (username: string) => {
    setActivePartner(username)
    setShowChallengeModal(false)
    setConversations((prev) =>
      prev.map((c) =>
        c.partner.username.toLowerCase() === username.toLowerCase()
          ? { ...c, hasUnread: false, unreadCount: 0 }
          : c,
      ),
    )
  }

  const dispatchSendMessage = async (text: string, tempId?: string) => {
    if (!activePartner || !currentUser) return

    const messageTempId =
      tempId ?? `temp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

    if (!tempId) {
      // If no tempId provided, append optimistic message now
      const optimisticMsg: DirectMessage = {
        id: messageTempId,
        conversationId: 'pending',
        senderUsername: currentUser.username,
        senderNickname: currentUser.nickname,
        senderPfpUrl: currentUser.pfpUrl,
        recipientUsername: activePartner,
        messageType: 'text',
        content: text,
        createdAt: Math.floor(Date.now() / 1000),
        status: 'sending',
      }
      setMessages((prev) => [...prev, optimisticMsg])
    }

    const res = await sendMessage(activePartner, text)
    if (res.ok && res.message) {
      const serverMsg: DirectMessage = {
        ...res.message,
        status: 'sent',
      }
      setMessages((prev) =>
        prev.map((m) => (m.id === messageTempId ? serverMsg : m)),
      )
      setConversations((prev) =>
        prev.map((c) => {
          if (c.partner.username.toLowerCase() === activePartner.toLowerCase()) {
            return {
              ...c,
              lastMessageAt: serverMsg.createdAt,
              lastMessage: {
                content: serverMsg.content,
                senderUsername: serverMsg.senderUsername,
                createdAt: serverMsg.createdAt,
              },
            }
          }
          return c
        }),
      )
    } else {
      if (res.cooldown) {
        setCooldown(res.cooldown)
        setQueue((q) => [text, ...q])
        setMessages((prev) => prev.filter((m) => m.id !== messageTempId))
      } else {
        const isTestAccountError =
          res.error === 'This account cannot receive messages.' ||
          res.error?.includes('test account')
        const failedContent = isTestAccountError
          ? 'This account cannot receive messages.'
          : `${text} (Failed: ${res.error || 'Unable to deliver message'})`

        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageTempId
              ? {
                  ...m,
                  failed: true,
                  status: 'failed',
                  content: failedContent,
                }
              : m,
          ),
        )
      }
    }
  }

  const handleSend = () => {
    const text = inputVal.trim()
    if (!text || !activePartner || !currentUser) return
    setInputVal('')

    if (cooldown > 0) {
      setQueue((prev) => [...prev, text])
      return
    }

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const optimisticMsg: DirectMessage = {
      id: tempId,
      conversationId: 'pending',
      senderUsername: currentUser.username,
      senderNickname: currentUser.nickname,
      senderPfpUrl: currentUser.pfpUrl,
      recipientUsername: activePartner,
      messageType: 'text',
      content: text,
      createdAt: Math.floor(Date.now() / 1000),
      status: 'sending',
    }

    setMessages((prev) => [...prev, optimisticMsg])
    void dispatchSendMessage(text, tempId)
  }

  const handleSendChallenge = async () => {
    if (!activePartner || !currentUser) return
    setShowChallengeModal(false)
    const manifest = MANIFESTS.find((m) => m.slug === selectedGame)
    const title = manifest?.title ?? selectedGame
    const content = `⚔️ Challenge: Beat my score of ${targetScore} in ${title}!`

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const optimisticMsg: DirectMessage = {
      id: tempId,
      conversationId: 'pending',
      senderUsername: currentUser.username,
      senderNickname: currentUser.nickname,
      senderPfpUrl: currentUser.pfpUrl,
      recipientUsername: activePartner,
      messageType: 'challenge',
      content,
      createdAt: Math.floor(Date.now() / 1000),
      status: 'sending',
    }

    setMessages((prev) => [...prev, optimisticMsg])

    const res = await sendMessage(activePartner, content, 'challenge', {
      gameSlug: selectedGame,
      targetScore,
      bountyCandy,
    })

    if (res.ok && res.message) {
      const serverMsg: DirectMessage = {
        ...res.message,
        status: 'sent',
      }
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? serverMsg : m)),
      )
    } else {
      const isTestAccountError =
        res.error === 'This account cannot receive messages.' ||
        res.error?.includes('test account')
      const failedContent = isTestAccountError
        ? 'This account cannot receive messages.'
        : `Challenge failed: ${res.error || 'Could not send challenge'}`

      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId
            ? {
                ...m,
                failed: true,
                status: 'failed',
                content: failedContent,
              }
            : m,
        ),
      )
    }
  }

  if (!currentUser) return null

  // Resolve recipient avatar
  const activeConvo = conversations.find(
    (c) => c.partner.username.toLowerCase() === activePartner?.toLowerCase(),
  )
  const activeFriend = friends.find(
    (f) => f.username.toLowerCase() === activePartner?.toLowerCase(),
  )
  const recipientPfp = activeConvo?.partner.pfpUrl ?? activeFriend?.pfpUrl ?? null

  const totalUnread = conversations.reduce(
    (sum, c) => sum + (c.unreadCount ?? (c.hasUnread ? 1 : 0)),
    0,
  )

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`nx-chat-trigger ${totalUnread > 0 ? 'nx-has-unread' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
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
            {activePartner ? (
              <div className="nx-chat-partner">
                <button
                  type="button"
                  className="nx-chat-back-btn"
                  onClick={() => setActivePartner(null)}
                  aria-label="Back to messages list"
                >
                  ←
                </button>
                <Link
                  to={ROUTES.userProfile(activePartner)}
                  className="nx-chat-header-avatar nx-chat-header-avatar-link"
                  title={`View @${activePartner}'s profile`}
                >
                  {recipientPfp ? (
                    <img src={recipientPfp} alt={activePartner} />
                  ) : (
                    <span>{activePartner.charAt(0).toUpperCase()}</span>
                  )}
                </Link>
                <span className="nx-chat-header-username">@{activePartner}</span>
              </div>
            ) : (
              <strong className="nx-chat-header-title">Messages</strong>
            )}
            <button
              type="button"
              className="nx-chat-close-btn"
              onClick={() => setIsOpen(false)}
              aria-label="Close chat"
            >
              ✕
            </button>
          </header>

          {!activePartner ? (
            <div className="nx-chat-convo-list">
              {conversations.length > 0 ? (
                <>
                  <div className="nx-chat-section-title">Recent Conversations</div>
                  {conversations.map((c) => (
                    <ConversationCard
                      key={c.id}
                      conversation={c}
                      onClick={() => handleSelectPartner(c.partner.username)}
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
                      onClick={() => handleSelectPartner(f.username)}
                    >
                      <div className="nx-friend-sidebar-avatar">
                        {f.pfpUrl ? (
                          <img src={f.pfpUrl} alt={f.username} />
                        ) : (
                          f.username.charAt(0).toUpperCase()
                        )}
                        <div
                          className="nx-friend-presence-dot"
                          data-state={f.presence.state}
                        />
                      </div>
                      <div className="nx-chat-friend-details">
                        <span className="nx-chat-friend-username">@{f.username}</span>
                        {f.nickname && (
                          <span className="nx-chat-friend-nickname">{f.nickname}</span>
                        )}
                      </div>
                    </button>
                  ))}
                </>
              )}
            </div>
          ) : (
            <>
              <div className="nx-chat-body">
                {messages.map((m) => {
                  const isMe =
                    m.senderUsername.toLowerCase() === currentUser.username.toLowerCase()
                  return (
                    <ChatMessageItem
                      key={m.id}
                      message={m}
                      isMe={isMe}
                      onPlayChallenge={() => setIsOpen(false)}
                    />
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {cooldown > 0 && (
                <div className="nx-chat-queue-indicator">
                  ⏱️ Rate limit cooldown: {cooldown}s ({queue.length} in queue)
                </div>
              )}

              <ChatDisclaimer recipientUsername={activePartner} />

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
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSend()
                  }}
                  maxLength={500}
                />
                <button
                  type="button"
                  className="nx-chat-send-btn"
                  onClick={handleSend}
                >
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
