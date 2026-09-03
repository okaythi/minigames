import { FLAGS, hasFlag, enableFlag, disableFlag, parseFlags, getActiveFlagNames } from '../shared/flags'
import type { MaxFourWords } from '../shared/flags'

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Assertion failed: ${message}`)
    process.exit(1)
  }
}

console.log('🧪 Running User Flags system unit tests...')

// 1. Check canonical flag catalogue
assert(FLAGS.USER_DEVELOPER.description === 'Labs Developer', 'USER_DEVELOPER description')
assert(FLAGS.USER_PIONEER.description === 'Labs Pioneer', 'USER_PIONEER description')

// Word count check
for (const [name, def] of Object.entries(FLAGS)) {
  const words = def.description.trim().split(/\s+/).filter(Boolean)
  assert(words.length <= 4, `${name} description has ${words.length} words (must be <= 4)`)
}

// 2. Type-level assertions
type ValidDesc = MaxFourWords<'Labs Developer'>
type InvalidDesc = MaxFourWords<'This description is way too long for a flag'>
const _testValid: ValidDesc = 'Labs Developer'
// @ts-expect-error - Must reject > 4 words
const _testInvalid: InvalidDesc = 'This description is way too long for a flag'

// 3. Helper tests
const emptyFlags = parseFlags('{}')
assert(!hasFlag(emptyFlags, 'USER_DEVELOPER'), 'Empty flags should not have USER_DEVELOPER')
assert(!hasFlag(emptyFlags, 'USER_PIONEER'), 'Empty flags should not have USER_PIONEER')

const withDev = enableFlag(emptyFlags, 'USER_DEVELOPER')
assert(hasFlag(withDev, 'USER_DEVELOPER'), 'Should have USER_DEVELOPER after enable')
assert(!hasFlag(withDev, 'USER_PIONEER'), 'Should not have USER_PIONEER yet')

const withBoth = enableFlag(withDev, 'USER_PIONEER', { grantedAt: 12345 })
assert(hasFlag(withBoth, 'USER_DEVELOPER'), 'Should still have USER_DEVELOPER')
assert(hasFlag(withBoth, 'USER_PIONEER'), 'Should now have USER_PIONEER')
assert(withBoth['USER_PIONEER']?.grantedAt === 12345, 'Should preserve metadata')

const active = getActiveFlagNames(withBoth)
assert(active.includes('USER_DEVELOPER') && active.includes('USER_PIONEER'), 'Active flags list')

const withoutDev = disableFlag(withBoth, 'USER_DEVELOPER')
assert(!hasFlag(withoutDev, 'USER_DEVELOPER'), 'Should not have USER_DEVELOPER after disable')
assert(hasFlag(withoutDev, 'USER_PIONEER'), 'Should still have USER_PIONEER')

// 4. Safe parsing tests
assert(Object.keys(parseFlags(null)).length === 0, 'parseFlags(null) -> {}')
assert(Object.keys(parseFlags(undefined)).length === 0, 'parseFlags(undefined) -> {}')
assert(Object.keys(parseFlags('invalid-json')).length === 0, 'parseFlags(invalid) -> {}')

const parsedJson = parseFlags('{"USER_PIONEER":{"enabled":true}}')
assert(hasFlag(parsedJson, 'USER_PIONEER'), 'parseFlags valid JSON string')

console.log('✅ All User Flags unit tests passed successfully!')
