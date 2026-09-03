import type {
  ParserInterface,
  ProjectionInterface,
  ReaderInterface,
  SubscriberInterface,
  WriterInterface,
} from './interfaces'

/**
 * Standard interface definitions known to the Update Notes Engine.
 */
export interface StandardInterfaceMap {
  readonly reader: ReaderInterface
  readonly writer: WriterInterface
  readonly subscriber: SubscriberInterface
  readonly projection: ProjectionInterface
  readonly parser: ParserInterface
}

/**
 * Extensible Interface Registry ("The Hoses Container").
 * Allows custom CMS tools, analytics hooks, or alternative storage engines
 * to be plugged in dynamically with complete type safety and zero "any".
 */
export class InterfaceRegistry {
  private readonly interfaces = new Map<string, unknown>()

  public constructor(initial?: Partial<StandardInterfaceMap>) {
    if (initial) {
      for (const [key, value] of Object.entries(initial)) {
        if (value !== undefined) {
          this.interfaces.set(key, value)
        }
      }
    }
  }

  /** Register a standard or custom interface. */
  public register<K extends keyof StandardInterfaceMap>(
    key: K,
    instance: StandardInterfaceMap[K],
  ): this
  public register<T>(key: string, instance: T): this
  public register(key: string, instance: unknown): this {
    this.interfaces.set(key, instance)
    return this
  }

  /** Retrieve a registered standard interface. */
  public get<K extends keyof StandardInterfaceMap>(key: K): StandardInterfaceMap[K]
  public get<T>(key: string): T
  public get(key: string): unknown {
    const value = this.interfaces.get(key)
    if (value === undefined) {
      throw new Error(`[InterfaceRegistry] No interface registered under key "${key}"`)
    }
    return value
  }

  /** Check if an interface is registered. */
  public has(key: string): boolean {
    return this.interfaces.has(key)
  }
}