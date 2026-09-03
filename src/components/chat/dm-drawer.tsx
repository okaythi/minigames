import { useState, useEffect, useRef } from 'react'
import { getCurrentUser } from '../../services/auth-api'
import {
  getConversations,
  getMessages,
  sendMessage,
  getMyFriends,
} from '../../services/social-api'
import type { DirectMessage, FriendSummary } from '../../../shared/auth-protocol'
import { MANIFESTS } from '../../games/registry'
import { Link } from '../../app/link'
import { ROUTES } from '../../app/parse-route'
import './dm-drawer.css'

export function DmDrawer() {
  const [isOpen, setIsOpen] = useState(false)
  const [conversations, setConversations] = useState<any[]>([])
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
  const currentUser = getCurrentUser()

  useEffect(() => {
    const handleOpenChat = (e: any) => {
      setIsOpen(true)
      if (e.detail?.username) {
        setActivePartner(e.detail.username)
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
      getMessages(activePartner).then((msgs) => {
        if (active) setMessages(msgs)
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
      void handleDirectSend(nextMsg)
    }
  }, [cooldown, queue, activePartner])

  const handleDirectSend = async (text: string) => {
    if (!activePartner) return
    const res = await sendMessage(activePartner, text)
    if (res.ok && res.message) {
      setMessages((prev) => [...prev, res.message!])
    } else {
      if (res.cooldown) {
        setCooldown(res.cooldown)
        setQueue((q) => [text, ...q])
      } else {
        // Mark failed in red
        const failedMsg: DirectMessage = {
          id: `err_${Date.now()}`,
          conversationId: 'error',
          senderUsername: currentUser?.username ?? 'me',
          senderNickname: currentUser?.nickname ?? null,
          senderPfpUrl: currentUser?.pfpUrl ?? null,
          recipientUsername: activePartner,
          messageType: 'text',
          content: `${text} (Failed: ${res.error || 'Unable to deliver message'})`,
          createdAt: Math.floor(Date.now() / 1000),
          failed: true,
        }
        setMessages((prev) => [...prev, failedMsg])
      }
    }
  }

  const handleSend = () => {
    const text = inputVal.trim()
    if (!text || !activePartner) return
    setInputVal('')

    if (cooldown > 0) {
      setQueue((prev) => [...prev, text])
    } else {
      void handleDirectSend(text)
    }
  }

  const handleSendChallenge = async () => {
    if (!activePartner) return
    setShowChallengeModal(false)
    const manifest = MANIFESTS.find((m) => m.slug === selectedGame)
    const title = manifest?.title ?? selectedGame
    const content = `⚔️ Challenge: Beat my score of ${targetScore} in ${title}!`

    const res = await sendMessage(activePartner, content, 'challenge', {
      gameSlug: selectedGame,
      targetScore,
      bountyCandy,
    })

    if (res.ok && res.message) {
      setMessages((prev) => [...prev, res.message!])
    } else {
      const failedMsg: DirectMessage = {
        id: `err_${Date.now()}`,
        conversationId: 'error',
        senderUsername: currentUser?.username ?? 'me',
        senderNickname: currentUser?.nickname ?? null,
        senderPfpUrl: currentUser?.pfpUrl ?? null,
        recipientUsername: activePartner,
        messageType: 'text',
        content: `Challenge failed: ${res.error || 'Could not send challenge'}`,
        createdAt: Math.floor(Date.now() / 1000),
        failed: true,
      }
      setMessages((prev) => [...prev, failedMsg])
    }
  }

  if (!currentUser) return null

  return (
    <>
      <button
        type="button"
        className="nx-chat-trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Open messages"
      >
        <span>💬</span>
        <span>Chat</span>
      </button>

      {isOpen && (
        <aside className="nx-chat-panel" aria-label="Direct messages panel">
          <header className="nx-chat-header">
            {activePartner ? (
              <div className="nx-chat-partner">
                <button
                  type="button"
                  className="nx-chat-close-btn"
                  onClick={() => setActivePartner(null)}
                  style={{ marginRight: '4px' }}
                >
                  ←
                </button>
                <span>@{activePartner}</span>
              </div>
            ) : (
              <strong style={{ fontSize: '14px', color: 'var(--nx-ink)' }}>Messages</strong>
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
                conversations.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="nx-chat-convo-item"
                    onClick={() => setActivePartner(c.partner.username)}
                  >
                    <div className="nx-friend-sidebar-avatar" style={{ width: '28px', height: '28px' }}>
                      {c.partner.pfpUrl ? (
                        <img src={c.partner.pfpUrl} alt={c.partner.username} />
                      ) : (
                        c.partner.username.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--nx-ink)' }}>
                        @{c.partner.username}
                      </div>
                      {c.partner.nickname && (
                        <div style={{ fontSize: '11px', color: 'var(--nx-slate)' }}>
                          {c.partner.nickname}
                        </div>
                      )}
                    </div>
                  </button>
                ))
              ) : (
                <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--nx-slate)', fontSize: '12.5px' }}>
                  No messages yet. Pick a friend to start chatting!
                </div>
              )}

              {friends.length > 0 && (
                <>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--nx-slate)', padding: '12px 10px 4px', textTransform: 'uppercase' }}>
                    Friends
                  </div>
                  {friends.map((f) => (
                    <button
                      key={f.username}
                      type="button"
                      className="nx-chat-convo-item"
                      onClick={() => setActivePartner(f.username)}
                    >
                      <div className="nx-friend-sidebar-avatar" style={{ width: '28px', height: '28px' }}>
                        {f.pfpUrl ? <img src={f.pfpUrl} alt={f.username} /> : f.username.charAt(0).toUpperCase()}
                        <div className="nx-friend-presence-dot" data-state={f.presence.state} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--nx-ink)' }}>
                          @{f.username}
                        </div>
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
                  const isMe = m.senderUsername.toLowerCase() === currentUser.username.toLowerCase()
                  const challengeMeta = m.metadata ? (() => { try { return JSON.parse(m.metadata) } catch { return null } })() : null

                  return (
                    <div
                      key={m.id}
                      className="nx-chat-msg"
                      data-me={isMe ? 'true' : 'false'}
                      data-failed={m.failed ? 'true' : undefined}
                    >
                      <div>{m.content}</div>

                      {challengeMeta && (
                        <div className="nx-chat-challenge-card">
                          <div style={{ fontWeight: 700, fontSize: '12.5px', marginBottom: '4px' }}>
                            ⚔️ Challenge: {challengeMeta.gameSlug}
                          </div>
                          <div style={{ fontSize: '11.5px', color: 'var(--nx-slate)' }}>
                            Target: <strong>{challengeMeta.targetScore}</strong>
                            {challengeMeta.bountyCandy > 0 && ` • 🍬 ${challengeMeta.bountyCandy} Candy`}
                          </div>
                          {!isMe && challengeMeta.status === 'pending' && (
                            <Link
                              to={`${ROUTES.game(challengeMeta.gameSlug)}?challengeId=${challengeMeta.challengeId}`}
                              className="nx-game-challenge-btn"
                              style={{ marginTop: '8px', fontSize: '11px', padding: '4px 8px' }}
                              onClick={() => setIsOpen(false)}
                            >
                              <span>Play Challenge</span>
                              <span>→</span>
                            </Link>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>

              {cooldown > 0 && (
                <div className="nx-chat-queue-indicator">
                  ⏱️ Rate limit cooldown: {cooldown}s ({queue.length} in queue)
                </div>
              )}

              {showChallengeModal && (
                <div style={{ padding: '10px', background: 'var(--nx-paper)', borderTop: '1px solid var(--nx-line)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '12px' }}>Send Game Challenge</strong>
                    <button type="button" className="nx-chat-close-btn" onClick={() => setShowChallengeModal(false)}>✕</button>
                  </div>
                  <select
                    value={selectedGame}
                    onChange={(e) => setSelectedGame(e.target.value)}
                    style={{ padding: '4px 6px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--nx-line)' }}
                  >
                    {MANIFESTS.map((m) => (
                      <option key={m.slug} value={m.slug}>{m.title}</option>
                    ))}
                  </select>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <label style={{ flex: 1, fontSize: '11px' }}>
                      Target Score:
                      <input
                        type="number"
                        value={targetScore}
                        onChange={(e) => setTargetScore(Number(e.target.value))}
                        style={{ width: '100%', padding: '3px 5px', fontSize: '12px' }}
                      />
                    </label>
                    <label style={{ flex: 1, fontSize: '11px' }}>
                      Candy Bounty:
                      <input
                        type="number"
                        value={bountyCandy}
                        onChange={(e) => setBountyCandy(Number(e.target.value))}
                        style={{ width: '100%', padding: '3px 5px', fontSize: '12px' }}
                      />
                    </label>
                  </div>
                  <button type="button" className="nx-chat-send-btn" onClick={handleSendChallenge}>
                    Issue Challenge ⚔️
                  </button>
                </div>
              )}

              <footer className="nx-chat-input-bar">
                <button
                  type="button"
                  title="Challenge Friend"
                  onClick={() => setShowChallengeModal(!showChallengeModal)}
                  style={{ background: 'transparent', border: 'none', fontSize: '16px', cursor: 'pointer' }}
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
