/**
 * A minimal observable store. Engines push immutable snapshots, React reads
 * them through `useSyncExternalStore` - no context-per-frame, no re-render
 * storms, no `any`.
 */

export interface Store<T> {
  readonly get: () => T
  readonly set: (next: T) => void
  readonly update: (recipe: (current: T) => T) => void
  readonly subscribe: (listener: () => void) => () => void
}

export function createStore<T>(initial: T): Store<T> {
  let current = initial
  const listeners = new Set<() => void>()
  return {
    get: () => current,
    set: (next) => {
      if (next === current) {
        return
      }
      current = next
      for (const listener of listeners) {
        listener()
      }
    },
    update: (recipe) => {
      const next = recipe(current)
      if (next !== current) {
        current = next
        for (const listener of listeners) {
          listener()
        }
      }
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
