import { eq, and, ne } from 'drizzle-orm'
import { users, players } from '../../../../../src/db/schema'
import { hashPassword } from '../../../../../shared/crypto'

interface BuildPatchInput {
  readonly db: any
  readonly user: any
  readonly body: any
}

interface BuildPatchResult {
  readonly error?: string | undefined
  readonly beforeDiff: Record<string, any>
  readonly afterDiff: Record<string, any>
  readonly userUpdates: Record<string, any>
  readonly candyUpdate?: number | undefined
}

export async function buildUserPatch({ db, user, body }: BuildPatchInput): Promise<BuildPatchResult> {
  const {
    username,
    nickname,
    nicknameChangedCount,
    registeredInCountry,
    registeredIp,
    lastLoginIp,
    lastLoginIpIsVpn,
    legacyUser,
    developer,
    accountLocked,
    candy,
    clearPfp,
    newPassword,
  } = body || {}

  const beforeDiff: Record<string, any> = {}
  const afterDiff: Record<string, any> = {}
  const userUpdates: Record<string, any> = {}

  // 1. Username
  if (typeof username === 'string' && username.trim() !== user.username) {
    const cleanUsername = username.trim().toLowerCase()
    if (!/^[a-z0-9_-]{3,24}$/.test(cleanUsername)) {
      return {
        error: 'Username must be 3-24 alphanumeric characters, dashes, or underscores',
        beforeDiff,
        afterDiff,
        userUpdates,
      }
    }
    const clash = await db
      .select()
      .from(users)
      .where(and(eq(users.username, cleanUsername), ne(users.playerId, user.playerId)))
      .get()
    if (clash) {
      return { error: 'Username is already taken', beforeDiff, afterDiff, userUpdates }
    }
    beforeDiff['username'] = user.username
    afterDiff['username'] = cleanUsername
    userUpdates['username'] = cleanUsername
  }

  // 2. Nickname
  if (nickname !== undefined) {
    const cleanNick = typeof nickname === 'string' && nickname.trim().length > 0 ? nickname.trim() : null
    if (cleanNick !== user.nickname) {
      beforeDiff['nickname'] = user.nickname
      afterDiff['nickname'] = cleanNick
      userUpdates['nickname'] = cleanNick
    }
  }

  // 3. Nickname change count limit reset
  if (typeof nicknameChangedCount === 'number' && nicknameChangedCount >= 0) {
    if (nicknameChangedCount !== user.nicknameChangedCount) {
      beforeDiff['nicknameChangedCount'] = user.nicknameChangedCount
      afterDiff['nicknameChangedCount'] = nicknameChangedCount
      userUpdates['nicknameChangedCount'] = nicknameChangedCount
    }
  }

  // 4. Geolocation & PII
  if (registeredInCountry !== undefined && registeredInCountry !== user.registeredInCountry) {
    beforeDiff['registeredInCountry'] = user.registeredInCountry
    afterDiff['registeredInCountry'] = registeredInCountry
    userUpdates['registeredInCountry'] = registeredInCountry
  }
  if (registeredIp !== undefined && registeredIp !== user.registeredIp) {
    beforeDiff['registeredIp'] = user.registeredIp
    afterDiff['registeredIp'] = registeredIp
    userUpdates['registeredIp'] = registeredIp
  }
  if (lastLoginIp !== undefined && lastLoginIp !== user.lastLoginIp) {
    beforeDiff['lastLoginIp'] = user.lastLoginIp
    afterDiff['lastLoginIp'] = lastLoginIp
    userUpdates['lastLoginIp'] = lastLoginIp
  }
  if (typeof lastLoginIpIsVpn === 'boolean') {
    const vpnInt = lastLoginIpIsVpn ? 1 : 0
    if (vpnInt !== user.lastLoginIpIsVpn) {
      beforeDiff['lastLoginIpIsVpn'] = user.lastLoginIpIsVpn
      afterDiff['lastLoginIpIsVpn'] = vpnInt
      userUpdates['lastLoginIpIsVpn'] = vpnInt
    }
  }

  // 5. Entitlements & status
  if (typeof legacyUser === 'boolean') {
    const legInt = legacyUser ? 1 : 0
    if (legInt !== user.legacyUser) {
      beforeDiff['legacyUser'] = user.legacyUser
      afterDiff['legacyUser'] = legInt
      userUpdates['legacyUser'] = legInt
    }
  }
  if (typeof developer === 'boolean') {
    const devInt = developer ? 1 : 0
    if (devInt !== user.developer) {
      beforeDiff['developer'] = user.developer
      afterDiff['developer'] = devInt
      userUpdates['developer'] = devInt
    }
  }
  if (typeof accountLocked === 'boolean') {
    const lockInt = accountLocked ? 1 : 0
    if (lockInt !== user.accountLocked) {
      beforeDiff['accountLocked'] = user.accountLocked
      afterDiff['accountLocked'] = lockInt
      userUpdates['accountLocked'] = lockInt
    }
  }

  // 6. Avatar
  if (clearPfp === true && user.pfpR2Key) {
    beforeDiff['pfpR2Key'] = user.pfpR2Key
    afterDiff['pfpR2Key'] = null
    userUpdates['pfpR2Key'] = null
  }

  // 7. Password reset
  if (typeof newPassword === 'string' && newPassword.length >= 6) {
    const { hash, salt } = await hashPassword(newPassword)
    userUpdates['passwordHash'] = hash
    userUpdates['passwordSalt'] = salt
    userUpdates['passwordLastChanged'] = Math.floor(Date.now() / 1000)
    afterDiff['password'] = 'Reset by Administrator'
  }

  // 8. Candy balance
  let candyUpdate: number | undefined
  if (typeof candy === 'number' && candy >= 0) {
    const playerRow = await db.select().from(players).where(eq(players.id, user.playerId)).get()
    if (playerRow && playerRow.candy !== candy) {
      beforeDiff['candy'] = playerRow.candy
      afterDiff['candy'] = candy
      candyUpdate = candy
    }
  }

  return { beforeDiff, afterDiff, userUpdates, candyUpdate }
}
