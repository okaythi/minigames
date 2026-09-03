import { UserFlags, type FlagDefinition, type MaxFourWords } from './types'

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
 * Canonical registry of active user flag metadata.
 *
 * Descriptions are strictly type-checked at compile time to never exceed 4 words.
 */
export const FLAGS_METADATA = {
  [UserFlags.USER_DEVELOPER]: defineFlag({
    description: 'Labs Developer',
  }),
  [UserFlags.USER_PIONEER]: defineFlag({
    description: 'Labs Pioneer',
  }),
  [UserFlags.STAFF]: defineFlag({
    description: 'Nixlabs Staff',
  }),
  [UserFlags.CMS_EDITOR]: defineFlag({
    description: 'Update Notes Editor',
  }),
} as const

export const FLAGS = FLAGS_METADATA
