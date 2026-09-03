import { UserFlags, type FlagDefinition, type MaxFourWords } from './types'

/**
 * Type-safe flag definition helper.
 * Enforces at compile-time that the description contains 10 words or fewer.
 */
function defineFlag<const TDesc extends string>(def: {
  readonly name: string
  readonly description: MaxFourWords<TDesc>
}): FlagDefinition<TDesc> {
  return def
}

/**
 * Canonical registry of active user flag metadata.
 * Each flag has a human-readable name (used in badge tooltips) and a description.
 */
export const FLAGS_METADATA = {
  [UserFlags.USER_DEVELOPER]: defineFlag({
    name: 'Labs Developer',
    description: 'Labs Developer',
  }),
  [UserFlags.USER_PIONEER]: defineFlag({
    name: 'Labs Pioneer',
    description: 'Labs Pioneer',
  }),
  [UserFlags.STAFF]: defineFlag({
    name: 'Staff',
    description: 'Nixlabs Staff',
  }),
  [UserFlags.CMS_EDITOR]: defineFlag({
    name: 'Update Notes Editor',
    description: 'Update Notes Editor',
  }),
} as const

export const FLAGS = FLAGS_METADATA
