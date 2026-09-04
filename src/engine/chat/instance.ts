import { ChatEngine } from './engine'
import { HttpChatTransport } from './transport'
import { systemClock } from './clock'
import { localChatPersistence } from './local-persistence'

/**
 * The browser singleton of the engine. Construction is side-effect free; the
 * wiring to auth/presence/visibility happens in `src/services/chat-boot.ts`,
 * because the engine must never know what "signed in" means.
 */
export const chatEngine = new ChatEngine({
  transport: new HttpChatTransport(),
  clock: systemClock,
  persistence: localChatPersistence,
})
