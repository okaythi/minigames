import {
  UserFlags,
  FLAGS_METADATA,
  hasFlag,
  enableFlag,
  disableFlag,
  hasAllFlags,
  hasAnyFlag,
  parseFlags,
  GameFlags,
  GAME_FLAGS_METADATA,
  hasGameFlag,
  enableGameFlag,
  disableGameFlag,
  hasAllGameFlags,
  hasAnyGameFlag,
  parseGameFlags,
  type MaxFourWords,
} from '../shared/flags'


function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Assertion failed: ${message}`)
    process.exit(1)
  }
}

console.log('🧪 Running User Flags Bitmask system unit tests...')

// 1. Check canonical flag catalogue
assert(FLAGS_METADATA[UserFlags.USER_DEVELOPER].description === 'Labs Developer', 'USER_DEVELOPER description')
assert(FLAGS_METADATA[UserFlags.USER_PIONEER].description === 'Labs Pioneer', 'USER_PIONEER description')
assert(FLAGS_METADATA[UserFlags.STAFF].description === 'Nixlabs Staff', 'STAFF description')
assert(FLAGS_METADATA[UserFlags.CMS_EDITOR].description === 'Update Notes Editor', 'CMS_EDITOR description')

// Word count check (<= 4 words)
for (const [bit, def] of Object.entries(FLAGS_METADATA)) {
  const words = def.description.trim().split(/\s+/).filter(Boolean)
  assert(words.length <= 4, `Bit ${bit} description has ${words.length} words (must be <= 4)`)
}


// 2. Type-level compile-time word validator assertions
type ValidDesc = MaxFourWords<'Labs Developer'>
type InvalidDesc = MaxFourWords<'This description is way too long for a flag'>
const _testValid: ValidDesc = 'Labs Developer'
// @ts-expect-error - Must reject > 4 words
const _testInvalid: InvalidDesc = 'This description is way too long for a flag'

// 3. Bitwise operations tests
let flags = UserFlags.NONE
assert(!hasFlag(flags, UserFlags.USER_DEVELOPER), 'NONE should not have USER_DEVELOPER')
assert(!hasFlag(flags, UserFlags.USER_PIONEER), 'NONE should not have USER_PIONEER')

// Enable USER_DEVELOPER
flags = enableFlag(flags, UserFlags.USER_DEVELOPER)
assert(hasFlag(flags, UserFlags.USER_DEVELOPER), 'flags should have USER_DEVELOPER')
assert(!hasFlag(flags, UserFlags.USER_PIONEER), 'flags should not have USER_PIONEER')
assert(flags === 1, 'flags vector should equal 1')

// Enable USER_PIONEER
flags = enableFlag(flags, UserFlags.USER_PIONEER)
assert(hasFlag(flags, UserFlags.USER_DEVELOPER), 'flags should still have USER_DEVELOPER')
assert(hasFlag(flags, UserFlags.USER_PIONEER), 'flags should now have USER_PIONEER')
assert(flags === 3, 'flags vector should equal 3 (0x03)')

// Compound checks
const PIONEER_DEV = UserFlags.USER_DEVELOPER | UserFlags.USER_PIONEER
assert(hasAllFlags(flags, PIONEER_DEV), 'flags should satisfy PIONEER_DEV requirement')
assert(hasAnyFlag(flags, UserFlags.USER_DEVELOPER), 'hasAnyFlag with single flag')

// Disable USER_DEVELOPER
flags = disableFlag(flags, UserFlags.USER_DEVELOPER)
assert(!hasFlag(flags, UserFlags.USER_DEVELOPER), 'USER_DEVELOPER should be disabled')
assert(hasFlag(flags, UserFlags.USER_PIONEER), 'USER_PIONEER should still be enabled')
assert(flags === 2, 'flags vector should equal 2 (0x02)')
assert(!hasAllFlags(flags, PIONEER_DEV), 'flags no longer satisfies all PIONEER_DEV')

// 4. Safe parsing tests
assert(parseFlags(null) === 0, 'parseFlags(null) -> 0')
assert(parseFlags(undefined) === 0, 'parseFlags(undefined) -> 0')
assert(parseFlags(3) === 3, 'parseFlags(3) -> 3')
assert(parseFlags('3') === 3, 'parseFlags("3") -> 3')
assert(parseFlags('invalid') === 0, 'parseFlags(invalid) -> 0')
assert(parseFlags('{"USER_PIONEER":{"enabled":true}}') === 2, 'parseFlags legacy JSON string')

// 5. Game Flags Bitmask tests
console.log('🧪 Running Game Flags Bitmask system unit tests...')
assert(GameFlags.NONE === 0, 'GameFlags.NONE === 0')
assert(GameFlags.GAME_BETA === 1, 'GameFlags.GAME_BETA === 1')
assert(GAME_FLAGS_METADATA[GameFlags.GAME_BETA].description === 'Early Access Beta', 'GAME_BETA metadata description')

// Game Flags bitwise ops
let gflags = GameFlags.NONE
assert(!hasGameFlag(gflags, GameFlags.GAME_BETA), 'NONE should not have GAME_BETA')
gflags = enableGameFlag(gflags, GameFlags.GAME_BETA)
assert(hasGameFlag(gflags, GameFlags.GAME_BETA), 'gflags should have GAME_BETA')
assert(hasGameFlag(gflags, 'GAME_BETA'), 'hasGameFlag with string flag name')
assert(gflags === 1, 'gflags vector should equal 1')
assert(hasAllGameFlags(gflags, GameFlags.GAME_BETA), 'hasAllGameFlags with GAME_BETA')
assert(hasAnyGameFlag(gflags, GameFlags.GAME_BETA), 'hasAnyGameFlag with GAME_BETA')

gflags = disableGameFlag(gflags, GameFlags.GAME_BETA)
assert(!hasGameFlag(gflags, GameFlags.GAME_BETA), 'GAME_BETA should be disabled')
assert(gflags === 0, 'gflags vector should equal 0')

// Game Manifest integration checks
assert(hasGameFlag({ flags: GameFlags.GAME_BETA }, GameFlags.GAME_BETA), 'manifest.flags vector')
assert(hasGameFlag({ flag: GameFlags.GAME_BETA }, GameFlags.GAME_BETA), 'manifest.flag bitmask')
assert(hasGameFlag({ flag: 'GAME_BETA' }, GameFlags.GAME_BETA), 'manifest.flag string')
assert(hasGameFlag({ gameFlag: 'GAME_BETA' }, GameFlags.GAME_BETA), 'manifest.gameFlag alias string')
assert(!hasGameFlag({ flags: 0 }, GameFlags.GAME_BETA), 'manifest with flags: 0')
assert(!hasGameFlag({}, GameFlags.GAME_BETA), 'manifest with no flags')
assert(!hasGameFlag(null, GameFlags.GAME_BETA), 'manifest null')
assert(!hasGameFlag(undefined, GameFlags.GAME_BETA), 'manifest undefined')

// Game Flags parsing
assert(parseGameFlags(null) === 0, 'parseGameFlags(null) -> 0')
assert(parseGameFlags(undefined) === 0, 'parseGameFlags(undefined) -> 0')
assert(parseGameFlags(1) === 1, 'parseGameFlags(1) -> 1')
assert(parseGameFlags('1') === 1, 'parseGameFlags("1") -> 1')
assert(parseGameFlags('GAME_BETA') === 1, 'parseGameFlags("GAME_BETA") -> 1')
assert(parseGameFlags('UNKNOWN') === 0, 'parseGameFlags("UNKNOWN") -> 0')

console.log('✅ All User Flags and Game Flags Bitmask unit tests passed successfully!')

