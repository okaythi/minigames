import { useDismissible } from '../../services/storage/dismissibles-store'

interface ChatDisclaimerProps {
  readonly recipientUsername: string
}

export function ChatDisclaimer({ recipientUsername }: ChatDisclaimerProps) {
  const [isDismissed, dismiss] = useDismissible(`chat_disclaimer_${recipientUsername.toLowerCase()}`)

  if (isDismissed) {
    return null
  }

  return (
    <div className="nx-chat-disclaimer" role="status">
      <span className="nx-chat-disclaimer-text">
        Never share personal information or passwords in this chat.
      </span>
      <button
        type="button"
        className="nx-chat-disclaimer-close"
        onClick={dismiss}
        aria-label="Dismiss security notice"
        title="Dismiss"
      >
        ✕
      </button>
    </div>
  )
}
