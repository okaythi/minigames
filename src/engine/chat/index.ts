/**
 * Public surface of the chat engine. UI code imports ONLY from here.
 *
 *   engine/chat  ← owns conversation state, outbound queue, polling policy
 *   notifications← owns badges (reads the chat list through ChatListSource)
 *   presence     ← owns the heartbeat; forwards unread deltas to both
 *   flags        ← shared/flags; the engine only displays partner.flags
 */
export type {
  ChatBanner,
  ChatMessageView,
  ChatSnapshot,
  ConversationView,
  OutboundEnvelope,
  OutboundState,
  PartnerKey,
} from './types'
export { partnerKey } from './types'
export type {
  ChatListSourceInterface,
  ChatSnapshotReaderInterface,
  ChatTransportInterface,
  ClockInterface,
  PersistenceInterface,
} from './interfaces'
export { ChatTransportError } from './interfaces'
export type { ConversationWithLocalState } from './types'
export { ChatEngine } from './engine'
export { ChatStore } from './store'
export { buildConversationView } from './projection'
export { reasonForCode } from './errors'
export { useChatController } from './hooks'
export type { ChatActions, ChatController } from './hooks'
export { chatEngine } from './instance'
