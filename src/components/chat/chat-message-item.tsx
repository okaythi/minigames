import { Link } from '../../app/link'
import { ROUTES } from '../../app/parse-route'
import { parseChallengeMetadata } from '../../../shared/chat-protocol'
import { classifyChatFailure } from '../../../shared/chat-protocol'
import type { ChatMessageView, OutboundState } from '../../engine/chat'

interface ChatMessageItemProps {
  readonly view: ChatMessageView
  readonly isMe: boolean
  readonly onPlayChallenge?: () => void
  readonly onRetry?: () => void
  readonly onResend?: () => void
  readonly onDismiss?: () => void
}

function formatLocalTime(timestampSeconds: number): string {
  const date = new Date(timestampSeconds * 1000)
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

function deliveryLabel(state: OutboundState): { text: string; status: 'sending' | 'failed' | 'queued' } {
  switch (state.kind) {
    case 'queued':
      return { text: 'Queued', status: 'queued' }
    case 'sending':
      return { text: 'Sending', status: 'sending' }
    case 'retry-scheduled':
      return { text: `Retrying (attempt ${state.attempt + 1})`, status: 'sending' }
    case 'rejected':
      return { text: 'Not delivered', status: 'failed' }
  }
}

export function ChatMessageItem({
  view,
  isMe,
  onPlayChallenge,
  onRetry,
  onResend,
  onDismiss,
}: ChatMessageItemProps) {
  const wire = view.wire
  if (wire === null) return null
  const outbound = view.outbound

  const challenge =
    wire.messageType === 'challenge' && outbound === null
      ? parseChallengeMetadata(wire.metadata)
      : null

  const delivery = outbound !== null ? deliveryLabel(outbound.state) : null
  const failed = delivery?.status === 'failed'
  // Policy rejections are final from the server's side; transient ones can
  // only be pushed again. The engine already decided — we just render it.
  const terminal =
    outbound !== null &&
    outbound.state.kind === 'rejected' &&
    classifyChatFailure(outbound.state.code) !== 'transient'

  return (
    <div className="nx-chat-msg-row" data-me={isMe ? 'true' : 'false'}>
      <div
        className="nx-chat-msg"
        data-me={isMe ? 'true' : 'false'}
        data-failed={failed ? 'true' : undefined}
        title={
          outbound !== null && outbound.state.kind === 'rejected'
            ? outbound.state.reason
            : undefined
        }
      >
        <div className="nx-chat-msg-text">{wire.content}</div>

        {challenge !== null && (
          <div className="nx-chat-challenge-card">
            <div className="nx-chat-challenge-title">⚔️ Challenge: {challenge.gameSlug}</div>
            <div className="nx-chat-challenge-details">
              Target: <strong>{challenge.targetScore}</strong>
              {challenge.bountyCandy > 0 && ` • 🍬 ${challenge.bountyCandy} Candy`}
            </div>
            {!isMe && challenge.status === 'pending' && (
              <Link
                to={`${ROUTES.game(challenge.gameSlug)}?challengeId=${challenge.challengeId}`}
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
        <span className="nx-chat-msg-time">{formatLocalTime(wire.createdAt)}</span>
        {delivery !== null ? (
          <span className="nx-chat-msg-status" data-status={delivery.status}>
            • {delivery.text}
            {failed && terminal && onResend !== undefined && (
              <button type="button" className="nx-chat-msg-action" onClick={onResend}>
                send anyway
              </button>
            )}
            {failed && !terminal && onRetry !== undefined && (
              <button type="button" className="nx-chat-msg-action" onClick={onRetry}>
                retry
              </button>
            )}
            {failed && onDismiss !== undefined && (
              <button
                type="button"
                className="nx-chat-msg-action nx-chat-msg-action-dismiss"
                onClick={onDismiss}
                aria-label="Dismiss undelivered message"
              >
                ✕
              </button>
            )}
          </span>
        ) : (
          isMe &&
          wire.id !== 'pending' && (
            <span className="nx-chat-msg-status" data-status={wire.readAt !== null ? 'read' : 'sent'}>
              • {wire.readAt !== null ? 'Read' : 'Sent'}
            </span>
          )
        )}
      </div>
    </div>
  )
}
