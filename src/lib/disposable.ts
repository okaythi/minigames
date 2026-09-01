/**
 * Resource plumbing. Anything that attaches listeners, observers or RAF loops
 * hands back a `Disposable`, so teardown is a single owned chain instead of a
 * scavenger hunt through `useEffect`.
 */

export interface Disposable {
  dispose(): void
}

export const asDisposable = (dispose: () => void): Disposable => ({ dispose })

export class DisposableBag {
  private readonly items: Disposable[] = []
  private closed = false

  public add(disposable: Disposable | (() => void)): void {
    if (this.closed) {
      this.run(disposable)
      return
    }
    this.items.push(typeof disposable === 'function' ? asDisposable(disposable) : disposable)
  }

  public dispose(): void {
    if (this.closed) {
      return
    }
    this.closed = true
    const items = this.items.splice(0, this.items.length)
    for (const item of items.reverse()) {
      item.dispose()
    }
  }

  private run(disposable: Disposable | (() => void)): void {
    if (typeof disposable === 'function') {
      disposable()
    } else {
      disposable.dispose()
    }
  }
}
