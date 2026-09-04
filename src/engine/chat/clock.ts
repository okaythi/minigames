import type { ClockInterface } from './interfaces'

/** Wall clock + timers behind a port so the engine is deterministically testable. */
export const systemClock: ClockInterface = {
  now: () => Date.now(),
  schedule: (callback, delayMs) =>
    globalThis.setTimeout(() => {
      callback()
    }, delayMs) as unknown as number,
  cancel: (handle) => {
    globalThis.clearTimeout(handle as unknown as ReturnType<typeof setTimeout>)
  },
}
