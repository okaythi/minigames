import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { UserLoginSchema } from '../../../shared/auth-protocol'
import { verifyPassword } from '../../../shared/crypto'
import { users } from '../../../src/db/schema'
import { readJsonBody } from '../stats/body'
import { badRequest, jsonResponse } from '../stats/respond'
import { serializePlayerCookie } from '../../../shared/player-cookie'

interface PagesContext {
  readonly request: Request
  readonly env: { NIXLABS_DB: D1Database }
}

export const onRequestPost = async ({ request, env }: PagesContext): Promise<Response> => {
  const json = await readJsonBody(request)
  const result = UserLoginSchema.safeParse(json)
  if (!result.success) {
    return badRequest('invalid payload')
  }

  const { username, password } = result.data
  const db = drizzle(env.NIXLABS_DB)

  const user = await db.select().from(users).where(eq(users.username, username)).get()
  if (!user) {
    return badRequest('invalid username or password')
  }

  const valid = await verifyPassword(password, user.passwordHash, user.passwordSalt)
  if (!valid) {
    return badRequest('invalid username or password')
  }

  const now = Math.floor(Date.now() / 1000)
  const cf = request.cf as any
  const ip = request.headers.get('cf-connecting-ip') || null
  const asOrg = (cf?.asOrganization || '').toLowerCase()
  const isVpn = /vpn|hosting|datacenter|digitalocean|aws|mullvad/i.test(asOrg) ? 1 : 0

  await db.update(users).set({
    lastLoggedIn: now,
    lastLoginIp: ip,
    lastLoginIpIsVpn: isVpn,
  }).where(eq(users.playerId, user.playerId))

  const cookie = serializePlayerCookie(user.playerId)

  return jsonResponse(200, { ok: true, username }, { cookie })
}
