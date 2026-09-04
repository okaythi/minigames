import { useMemo, useSyncExternalStore } from 'react'
import { chatEngine } from './instance'
import type { ChatSnapshot, ConversationView } from './types'

/**
 * The only React surface of the chat engine. Components read the snapshot
 * and call actions — no fetching, timers or state machines are ever written
 * in a component again.
 */
export interface ChatActions {
  readonly openPanel: () => void
  readonly closePanel: () => void
  readonly selectConversation: (partner: string | null) => void
  readonly send: (partner: string, content: string) => void
  readonly sendChallenge: (
    partner: string,
    content: string,
    challenge: { readonly gameSlug: string; readonly targetScore: number; readonly bountyCandy: number },
  ) => void
  readonly setDraft: (partner: string, draft: string) => void
  readonly retry: (clientMessageId: string) => void
  readonly resend: (clientMessageId: string) => void
  readonly dismissEnvelope: (clientMessageId: string) => void
  readonly dismissBanner: (partner: string) => void
}

export interface ChatController {
  readonly snapshot: ChatSnapshot
  readonly active: ConversationView | null
  readonly actions: ChatActions
}

export function useChatController(): ChatController {
  const snapshot = useSyncExternalStore(chatEngine.subscribe, chatEngine.getSnapshot, chatEngine.getSnapshot)
  const actions = useMemo<ChatActions>(
    () => ({
      openPanel: () => chatEngine.openPanel(),
      closePanel: () => chatEngine.closePanel(),
      selectConversation: (partner) => chatEngine.selectConversation(partner),
      send: (partner, content) => chatEngine.send(partner, content),
      sendChallenge: (partner, content, challenge) =>
        chatEngine.send(partner, content, 'challenge', challenge),
      setDraft: (partner, draft) => chatEngine.setDraft(partner, draft),
      retry: (clientMessageId) => chatEngine.retryEnvelope(clientMessageId),
      resend: (clientMessageId) => chatEngine.resendEnvelope(clientMessageId),
      dismissEnvelope: (clientMessageId) => chatEngine.dismissEnvelope(clientMessageId),
      dismissBanner: (partner) => chatEngine.dismissBanner(partner),
    }),
    [],
  )

  const active = useMemo<ConversationView | null>(
    () =>
      snapshot.activeKey === null
        ? null
        : snapshot.conversations.find((c) => c.key === snapshot.activeKey) ?? null,
    [snapshot],
  )

  return { snapshot, active, actions }
}
