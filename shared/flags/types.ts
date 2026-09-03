/**
 * Core User Flags type definitions and compile-time validators.
 */

/** Single flag record inside a user's flags dictionary. */
export interface UserFlagState {
  readonly enabled?: boolean
  readonly grantedAt?: number
  readonly [key: string]: unknown
}

/** Dictionary of user flags attached to a user account. */
export type UserFlags = Record<string, UserFlagState>

/** Helper types for compile-time word count parsing. */
type SplitWords<S extends string> =
  S extends `${infer Head} ${infer Tail}`
    ? [Head, ...SplitWords<Tail>]
    : [S]

type NonEmptyWords<T extends string[]> =
  T extends [infer Head, ...infer Tail extends string[]]
    ? Head extends ''
      ? NonEmptyWords<Tail>
      : [Head, ...NonEmptyWords<Tail>]
    : []

export type WordCount<S extends string> = NonEmptyWords<SplitWords<S>>['length']

/**
 * Enforces that a string literal has between 1 and 4 words at compile time.
 * If longer than 4 words, evaluates to an error string literal.
 */
export type MaxFourWords<T extends string> =
  WordCount<T> extends 1 | 2 | 3 | 4
    ? T
    : 'ERROR: Flag description must be 4 words or fewer'

export interface FlagDefinition<TDesc extends string = string> {
  readonly description: MaxFourWords<TDesc>
}
