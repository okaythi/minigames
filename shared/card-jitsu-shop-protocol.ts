export interface ShopColorItem {
  readonly id: number
  readonly name: string
  readonly hex: string
  readonly price: number
  readonly originalPrice?: number
  readonly isPromoActive?: boolean
  readonly promoBadge?: string
  readonly iconUrl: string
  readonly owned: boolean
  readonly equipped: boolean
}

export interface ShopPackInfo {
  readonly price: number
  readonly originalPrice?: number
  readonly isPromoActive?: boolean
  readonly promoBadge?: string
  readonly promoTagline?: string
  readonly isFirstPurchasePromo?: boolean
  readonly name: string
  readonly description: string
  readonly iconUrl: string
  readonly normalCardsCount: number
  readonly powerCardsCount: number
}

export interface CardJitsuShopStateResponse {
  readonly ok: boolean
  readonly candy: number
  readonly equippedColorId: number
  readonly ownedColorIds: readonly number[]
  readonly colors: readonly ShopColorItem[]
  readonly pack: ShopPackInfo
}

export interface BuyColorPayload {
  readonly colorId: number
}

export interface BuyColorResponse {
  readonly ok: boolean
  readonly candy?: number
  readonly colorId?: number
  readonly error?: string
}

export interface EquipColorPayload {
  readonly colorId: number
}

export interface EquipColorResponse {
  readonly ok: boolean
  readonly colorId?: number
  readonly error?: string
}

export interface DrawnCard {
  readonly id: number
  readonly name: string
  readonly element: 'f' | 'w' | 's'
  readonly color: 'r' | 'b' | 'g' | 'y' | 'o' | 'p'
  readonly value: number
  readonly powerId: number
  readonly description: string
  readonly totalOwned: number
  readonly isNew: boolean
}

export interface BuyPackResponse {
  readonly ok: boolean
  readonly candy?: number
  readonly cards?: readonly DrawnCard[]
  readonly error?: string
}
