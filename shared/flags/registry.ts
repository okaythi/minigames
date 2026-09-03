import type { FlagDefinition, MaxFourWords } from './types'

/**
 * Type-safe flag definition helper.
 * Enforces at compile-time that the description contains 4 words or fewer.
 */
function defineFlag<const TDesc extends string>(def: {
  readonly description: MaxFourWords<TDesc>
}): FlagDefinition<TDesc> {
  return def
}

/**
 * Canonical registry of all user flags.
 *
 * Descriptions are strictly type-checked at compile time to never exceed 4 words.
 */
export const FLAGS = {
  USER_DEVELOPER: defineFlag({
    description: 'Labs Developer',
  }),
  USER_PIONEER: defineFlag({
    description: 'Labs Pioneer',
  }),
} as const

export type UserFlagName = keyof typeof FLAGS
