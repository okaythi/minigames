import type { ConversationView } from '../../engine/chat'

interface ConversationCardProps {
  readonly conversation: ConversationView
  readonly isSelected?: boolean
  readonly onClick: () => void
}

export function formatLastMessageSnippet(senderUsername: string, content: string): string {
  const prefix = `@${senderUsername}: `
  const trimmed = content.trim()
  const words = trimmed.split(/\s+/)

  let displayContent: string
  if (words.length > 8) {
    displayContent = words.slice(0, 8).join(' ') + '...'
  } else if (trimmed.length > 45) {
    // In case of unbroken string / spam of letters without spaces
    displayContent = trimmed.slice(0, 42) + '...'
  } else {
    displayContent = trimmed
  }

  return `${prefix}${displayContent}`
}

export function ConversationCard({
  conversation,
  isSelected,
  onClick,
}: ConversationCardProps) {
  const { partner, nickname, pfpUrl, lastMessage, unreadCount } = conversation
  const showUnreadDot = unreadCount > 0

  return (
    <button
      type="button"
      className={`nx-chat-convo-item ${isSelected ? 'nx-selected' : ''}`}
      onClick={onClick}
      aria-label={`Chat with @${partner}`}
    >
      <div className="nx-chat-convo-avatar">
        {pfpUrl ? (
          <img src={pfpUrl} alt={partner} />
        ) : (
          <span>{partner.charAt(0).toUpperCase()}</span>
        )}
      </div>

      <div className="nx-chat-convo-details">
        <div className="nx-chat-convo-top-row">
          <span className="nx-chat-convo-username">@{partner}</span>
          {nickname && <span className="nx-chat-convo-nickname">{nickname}</span>}
        </div>

        <div className="nx-chat-convo-snippet">
          {lastMessage ? (
            formatLastMessageSnippet(lastMessage.senderUsername, lastMessage.content)
          ) : (
            <span className="nx-chat-convo-empty-snippet">No messages yet</span>
          )}
        </div>
      </div>

      {showUnreadDot && (
        <div
          className="nx-chat-unread-dot"
          title="Unread messages"
          aria-label="Unread messages"
        />
      )}
    </button>
  )
}
