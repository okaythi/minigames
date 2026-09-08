/**
 * Invariant & Unit Tests for NixLabs Admin Backend and Snowflake System.
 * Tests snowflake encoding/decoding, monotonic properties, session cookies, and flag matrix.
 */

import {
  nextSnowflake,
  decodeSnowflake,
  toDisplayId,
  SNOWFLAKE_EPOCH_MS,
} from '../shared/snowflake'
import {
  UserFlags,
  GameFlags,
  hasFlag,
  enableFlag,
  disableFlag,
  FLAGS_METADATA,
  GAME_FLAGS_METADATA,
} from '../shared/flags'
import {
  serializeSessionCookie,
  serializeClearSessionCookie,
  hashIp,
} from '../shared/session'

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`)
    process.exit(1)
  }
  console.log(`  ✓ ${msg}`)
}

async function run() {
  console.log('🧪 Testing Snowflake ID System...')

  // 1. Next snowflake length and zero padding
  const sf1 = nextSnowflake(0)
  assert(sf1.length === 19, `Snowflake length is 19 digits (got ${sf1.length})`)
  assert(/^\d{19}$/.test(sf1), 'Snowflake contains only decimal digits')

  // 2. Decode verification
  const decoded1 = decodeSnowflake(sf1)
  assert(decoded1.creatorId === 0, `Decoded creatorId is 0 (got ${decoded1.creatorId})`)
  assert(decoded1.timestampMs >= SNOWFLAKE_EPOCH_MS, 'Decoded timestamp is >= SNOWFLAKE_EPOCH_MS')
  assert(decoded1.sequence >= 0 && decoded1.sequence <= 4095, 'Sequence is in [0, 4095]')

  // 3. Creator ID propagation
  const sfCreator = nextSnowflake(42)
  const decodedCreator = decodeSnowflake(sfCreator)
  assert(decodedCreator.creatorId === 42, `Decoded creatorId is 42 (got ${decodedCreator.creatorId})`)

  // 4. Monotonic ordering
  const sf2 = nextSnowflake(0)
  assert(sf2 > sf1, `Monotonic order: sf2 (${sf2}) > sf1 (${sf1})`)

  // 5. Display ID formatting (strips zero padding)
  const displayId = toDisplayId(sf1)
  assert(!displayId.startsWith('0'), 'Display ID does not contain leading zero')
  assert(BigInt(displayId) === BigInt(sf1), 'Display ID parses to identical BigInt value')

  console.log('\n🧪 Testing Admin Flags & RBAC Capability Bits...')
  // Bit checks
  assert(UserFlags.USERS_ADMIN === 256, 'USERS_ADMIN bit is 256 (1 << 8)')
  assert(UserFlags.GAMES_ADMIN === 512, 'GAMES_ADMIN bit is 512 (1 << 9)')
  assert(UserFlags.PLATFORM_ADMIN === 1024, 'PLATFORM_ADMIN bit is 1024 (1 << 10)')
  assert(GameFlags.FEATURED === 2, 'FEATURED game flag bit is 2 (1 << 1)')

  // Metadata word counts <= 4 words
  for (const [bit, meta] of Object.entries(FLAGS_METADATA)) {
    const wordCount = meta.description.trim().split(/\s+/).length
    assert(wordCount <= 4, `User flag ${bit} (${meta.name}) description has <= 4 words (${wordCount})`)
  }
  for (const [bit, meta] of Object.entries(GAME_FLAGS_METADATA)) {
    const wordCount = meta.description.trim().split(/\s+/).length
    assert(wordCount <= 4, `Game flag ${bit} (${meta.name}) description has <= 4 words (${wordCount})`)
  }

  // Capability matrix test
  let staffUser = enableFlag(UserFlags.NONE, UserFlags.STAFF)
  assert(hasFlag(staffUser, UserFlags.STAFF), 'staffUser has STAFF')
  assert(!hasFlag(staffUser, UserFlags.USERS_ADMIN), 'staffUser initially does not have USERS_ADMIN')

  staffUser = enableFlag(staffUser, UserFlags.USERS_ADMIN)
  assert(hasFlag(staffUser, UserFlags.USERS_ADMIN), 'staffUser has USERS_ADMIN')
  assert(!hasFlag(staffUser, UserFlags.PLATFORM_ADMIN), 'USERS_ADMIN cannot access PLATFORM_ADMIN')

  console.log('\n🧪 Testing Session Serialization & IP Hashing...')
  const dummyToken = 'uuid-test-session-123'
  const cookieStr = serializeSessionCookie(dummyToken)
  assert(cookieStr.includes(`session_token=${dummyToken}`), 'Cookie header contains token')
  assert(cookieStr.includes('HttpOnly'), 'Cookie header includes HttpOnly')
  assert(cookieStr.includes('SameSite=Strict'), 'Cookie header includes SameSite=Strict')

  const clearCookieStr = serializeClearSessionCookie()
  assert(clearCookieStr.includes('Max-Age=0'), 'Clear cookie sets Max-Age=0')

  const ipHash = await hashIp('192.168.1.1')
  assert(typeof ipHash === 'string' && ipHash.length === 64, 'IP hash produces 64-char SHA-256 hex string')

  console.log('\n✅ All Admin Backend and Snowflake System tests passed successfully!')
}

void run()
