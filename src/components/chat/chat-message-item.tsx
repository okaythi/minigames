import { Link } from '../../app/link'
import { ROUTES } from '../../app/parse-route'
import type { DirectMessage } from '../../../shared/auth-protocol'

interface ChatMessageItemProps {
  readonly message: DirectMessage
  readonly isMe: boolean
  readonly onPlayChallenge?: () => void
}

function formatLocalTime(timestampSeconds: number): string {
  const date = new Date(timestampSeconds * 1000)
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

export function ChatMessageItem({ message, isMe, onPlayChallenge }: ChatMessageItemProps) {
  const challengeMeta = message.metadata ? (() => {
    try {
      return JSON.parse(message.metadata)
    } catch {
      return null
    }
  })() : null

  const formattedTime = formatLocalTime(message.createdAt)
  const isSending = message.status === 'sending'

  return (
    <div className="nx-chat-msg-row" data-me={isMe ? 'true' : 'false'}>
      <div
        className="nx-chat-msg"
        data-me={isMe ? 'true' : 'false'}
        data-failed={message.failed ? 'true' : undefined}
      >
        <div className="nx-chat-msg-text">{message.content}</div>

        {challengeMeta && (
          <div className="nx-chat-challenge-card">
            <div className="nx-chat-challenge-title">
              ⚔️ Challenge: {challengeMeta.gameSlug}
            </div>
            <div className="nx-chat-challenge-details">
              Target: <strong>{challengeMeta.targetScore}</strong>
              {challengeMeta.bountyCandy > 0 && ` • 🍬 ${challengeMeta.bountyCandy} Candy`}
            </div>
            {!isMe && challengeMeta.status === 'pending' && (
              <Link
                to={`${ROUTES.game(challengeMeta.gameSlug)}?challengeId=${challengeMeta.challengeId}`}
                className="nx-game-challenge-btn"
                onClick={onPlayChallenge}
              >
                <span>Play Challenge</span>
                <span>→</span>
              </Link>
            )}
          </div>
        )}
      </div>

      <div className="nx-chat-msg-footer" data-me={isMe ? 'true' : 'false'}>
        <span className="nx-chat-msg-time">{formattedTime}</span>
        {isMe && !message.failed && (
          <span
            className="nx-chat-msg-status"
            data-status={isSending ? 'sending' : 'sent'}
          >
            • {isSending ? 'Sending' : 'Sent'}
          </span>
        )}
        {message.failed && (
          <span className="nx-chat-msg-status" data-status="failed">
            • Failed
          </span>
        )}
      </div>
    </div>
  )
}
