import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { users, players, cjNinja, cjNinjaColors } from '../../../../src/db/schema'
import { identifyPlayer } from '../../stats/identity'
import { storeFor, type StatsEnv } from '../../stats/store-for'
import { jsonResponse } from '../../stats/respond'
import { DOJO_STORE_CONFIG } from '../../../../shared/card-jitsu-store-config'
import { buildPackInfo } from './pack-info'
import type { CardJitsuShopStateResponse, ShopColorItem } from '../../../../shared/card-jitsu-shop-protocol'

interface PagesContext {
  readonly request: Request
  readonly env: StatsEnv & { NIXLABS_DB: D1Database }
}

export const onRequestGet = async ({ request, env }: PagesContext): Promise<Response> => {
  const store = storeFor(env)
  const { playerId } = await identifyPlayer(request, store)
  if (!playerId) {
    return jsonResponse(401, { ok: false, error: 'unauthorized' })
  }

  const db = drizzle(env.NIXLABS_DB)
  const user = await db.select().from(users).where(eq(users.playerId, playerId)).get()
  if (!user) {
    return jsonResponse(401, { ok: false, error: 'unauthorized' })
  }

  const playerRow = await db.select().from(players).where(eq(players.id, playerId)).get()
  const candy = playerRow?.candy ?? 0

  const ninja = await db.select().from(cjNinja).where(eq(cjNinja.userId, playerId)).get()
  const equippedColorId = ninja?.colorId ?? 1

  const ownedColorRows = await db
    .select({ colorId: cjNinjaColors.colorId })
    .from(cjNinjaColors)
    .where(eq(cjNinjaColors.userId, playerId))
    .all()

  // Color 1 is always unlocked by default
  const ownedColorSet = new Set<number>([1, ...ownedColorRows.map((r) => r.colorId)])

  const packsPurchased = (ninja as { packsPurchased?: number } | undefined)?.packsPurchased ?? 0
  const isFirstPurchase = packsPurchased === 0

  const colors: ShopColorItem[] = DOJO_STORE_CONFIG.colors.map((c) => {
    const isOwned = ownedColorSet.has(c.id) || c.defaultUnlocked === true
    const isEquipped = c.id === equippedColorId
    const colorDiscount =
      c.originalPrice !== undefined && c.originalPrice > c.price
        ? Math.round(((c.originalPrice - c.price) / c.originalPrice) * 100)
        : 0
    const colorBadge = colorDiscount > 0 ? `${colorDiscount}% OFF` : c.promoBadge

    return {
      id: c.id,
      name: c.name,
      hex: c.hex,
      price: c.price,
      ...(c.originalPrice !== undefined ? { originalPrice: c.originalPrice } : {}),
      ...(c.isPromoActive !== undefined ? { isPromoActive: c.isPromoActive } : {}),
      ...(colorBadge !== undefined ? { promoBadge: colorBadge } : {}),
      iconUrl: `/games/card-jitsu/assets/colors/${c.iconFile}`,
      owned: isOwned,
      equipped: isEquipped,
    }
  })

  const response: CardJitsuShopStateResponse = {
    ok: true,
    candy,
    equippedColorId,
    ownedColorIds: Array.from(ownedColorSet),
    colors,
    pack: buildPackInfo(isFirstPurchase),
  }

  return jsonResponse(200, response)
}
