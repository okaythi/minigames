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
  [UserFlags.USER_FRIENDS_BLOCKED]: defineFlag({
    name: 'Friends Blocked',
    description: 'Friends Management Blocked',
  }),
  [UserFlags.USER_FRIENDS_MAX]: defineFlag({
    name: 'Max Friends Reached',
    description: 'Max Friends Limit Reached',
  }),
  [UserFlags.TEST_ACCOUNT]: defineFlag({
    name: 'Test Account',
    description: 'Internal Sandbox Test Account',
  }),
  [UserFlags.USER_MESSAGES_BLOCKED]: defineFlag({
    name: 'Messaging Suspended',
    description: 'Direct Messaging Suspended',
  }),
} as const

export const FLAGS = FLAGS_METADATA
