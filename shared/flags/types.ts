/**
 * User Flags — Bitmask Vector System.
 *
 * Flags represent discrete account capabilities, entitlements, and roles.
 * Compressed into a compact integer bitmask for single-clock-cycle bitwise evaluation.
 */

/**
 * Compact binary flag definitions.
 */
export const UserFlags = {
  NONE: 0,
  USER_DEVELOPER:        1 << 0, // Bit 0 (0001) = 1
  USER_PIONEER:          1 << 1, // Bit 1 (0010) = 2
  STAFF:                 1 << 2, // Bit 2 (0100) = 4
  CMS_EDITOR:            1 << 3, // Bit 3 (1000) = 8
  USER_FRIENDS_BLOCKED:  1 << 4, // Bit 4 (0001 0000) = 16
  USER_FRIENDS_MAX:      1 << 5, // Bit 5 (0010 0000) = 32
  TEST_ACCOUNT:          1 << 6, // Bit 6 (0100 0000) = 64
  USER_MESSAGES_BLOCKED: 1 << 7, // Bit 7 (1000 0000) = 128
} as const

export type UserFlagsBit = (typeof UserFlags)[keyof typeof UserFlags]
export type UserFlags = number

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
 * Enforces that a string literal has 10 words or fewer at compile time.
 * If longer than 10 words, evaluates to a compiler error string.
 */
export type MaxFourWords<T extends string> =
  WordCount<T> extends 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10
    ? T
    : 'ERROR: Flag description must be 10 words or fewer'


export interface FlagDefinition<TDesc extends string = string> {
  readonly name: string
  readonly description: MaxFourWords<TDesc>
}

/**
 * Game Flags — Discrete feature/visibility gating for games.
 */
export const GameFlags = {
  NONE: '',
  GAME_BETA: 'GAME_BETA',
} as const

export type GameFlag = (typeof GameFlags)[keyof typeof GameFlags] | string
