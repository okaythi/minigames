import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { UserRegisterSchema } from '../../../shared/auth-protocol'
import { UserFlags } from '../../../shared/flags'
import { hashPassword } from '../../../shared/crypto'
import { users, players, playerAchievements } from '../../../src/db/schema'
import { readJsonBody } from '../stats/body'
import { badRequest, jsonResponse } from '../stats/respond'
import { identifyPlayer } from '../stats/identity'
import { serializePlayerCookie } from '../../../shared/player-cookie'
import { storeFor, type StatsEnv } from '../stats/store-for'

interface PagesContext {
  readonly request: Request
  readonly env: StatsEnv & { NIXLABS_DB: D1Database }
}

export const onRequestPost = async ({ request, env }: PagesContext): Promise<Response> => {
  const json = await readJsonBody(request)
  const result = UserRegisterSchema.safeParse(json)
  if (!result.success) {
    return badRequest('invalid payload')
  }

  const { username, password } = result.data
  const { hash, salt } = await hashPassword(password)
  const db = drizzle(env.NIXLABS_DB)

  // Check if username taken
  const existingUser = await db.select().from(users).where(eq(users.username, username)).get()
  if (existingUser) {
    return badRequest('username taken')
  }

  const store = storeFor(env)
  let { playerId, cookie } = await identifyPlayer(request, store)
  
  const now = Math.floor(Date.now() / 1000)
  const cf = request.cf as any
  const country = cf?.country || null
  const ip = request.headers.get('cf-connecting-ip') || null
  const asOrg = (cf?.asOrganization || '').toLowerCase()
  const isVpn = /vpn|hosting|datacenter|digitalocean|aws|mullvad/i.test(asOrg) ? 1 : 0

  let legacyUser = 1
  if (!playerId) {
    // Generate new UUID for the new user
    playerId = crypto.randomUUID()
    legacyUser = 0
    // We must insert a blank player row because `users.player_id` references `players.id`
    await db.insert(players).values({
      id: playerId,
      firstSeen: now,
      lastSeen: now,
      candy: 0,
    })
  } else {
    // Check if they are already registered
    const alreadyLinked = await db.select().from(users).where(eq(users.playerId, playerId)).get()
    if (alreadyLinked) {
      return badRequest('device already linked to an account')
    }
  }

  await db.insert(users).values({
    playerId,
    username,
    passwordHash: hash,
    passwordSalt: salt,
    createdOn: now,
    lastLoggedIn: now,
    registeredInCountry: country,
    legacyUser,
    flags: legacyUser === 1 ? UserFlags.USER_PIONEER : UserFlags.NONE,
    accountLocked: 0,
    lastLoginIp: ip,
    lastLoginIpIsVpn: isVpn,
    registeredIp: ip,
  })

  // Auto-award Claimed Identity achievement on account creation
  try {
    await db.insert(playerAchievements).values({
      playerId,
      id: 'identity_claimed',
      progress: 1,
      unlockedAt: now,
    })
  } catch {
    // Ignore if already present
  }

  // We set a new HttpOnly session cookie, but since the playerId cookie is already HttpOnly
  // and acts as the unique session identifier for D1, we might just reuse the same cookie.
  // We'll return success and the cookie to be re-planted.
  if (!cookie) {
    cookie = serializePlayerCookie(playerId)
  }
  return jsonResponse(200, { ok: true, username }, { cookie })
}
