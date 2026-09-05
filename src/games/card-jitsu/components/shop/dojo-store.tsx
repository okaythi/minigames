import { useCallback, useEffect, useState } from 'react'
import type { CardJitsuRuntimeExtended } from '../../runtime'
import type {
  BuyColorPayload,
  BuyColorResponse,
  BuyPackResponse,
  CardJitsuShopStateResponse,
  DrawnCard,
  EquipColorPayload,
  EquipColorResponse,
  ShopColorItem,
  ShopPackInfo,
} from '../../../../../shared/card-jitsu-shop-protocol'
import type { OwnedCard } from '../../../../../shared/card-jitsu-protocol'
import { DOJO_STORE_CONFIG } from '../../store.config'
import { PackStorePanel } from './pack-store-panel'
import { ChestOpeningView } from './chest-opening-view'
import { ColorSelectPanel } from './color-select-panel'
import { OwnedCardsBrowser } from './owned-cards-browser'
import './dojo-store.css'

interface DojoStoreProps {
  readonly runtime: CardJitsuRuntimeExtended | null
  readonly onColorEquipped?: (colorId: number) => void
}

export function DojoStore({ runtime, onColorEquipped }: DojoStoreProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userCandy, setUserCandy] = useState<number>(0)
  const [equippedColorId, setEquippedColorId] = useState<number>(1)
  const [colors, setColors] = useState<readonly ShopColorItem[]>([])
  const [packInfo, setPackInfo] = useState<ShopPackInfo>({
    price: DOJO_STORE_CONFIG.pack.price,
    originalPrice: DOJO_STORE_CONFIG.pack.originalPrice,
    isPromoActive: DOJO_STORE_CONFIG.pack.isPromoActive,
    promoBadge: DOJO_STORE_CONFIG.pack.promoBadge,
    name: DOJO_STORE_CONFIG.pack.name,
    description: DOJO_STORE_CONFIG.pack.description,
    iconUrl: DOJO_STORE_CONFIG.pack.iconUrl,
    normalCardsCount: DOJO_STORE_CONFIG.packRules.normalCardsCount,
    powerCardsCount: DOJO_STORE_CONFIG.packRules.powerCardsCount,
  })
  const [ownedCards, setOwnedCards] = useState<readonly OwnedCard[]>([])
  const [activeDrawnCards, setActiveDrawnCards] = useState<readonly DrawnCard[] | null>(null)

  // Fetch shop state and card collection
  const fetchShopData = useCallback(async () => {
    try {
      setLoading(true)
      const [shopRes, profile] = await Promise.all([
        fetch('/api/card-jitsu/shop'),
        runtime?.refreshProfile ? runtime.refreshProfile() : null,
      ])

      if (shopRes.ok) {
        const data = (await shopRes.json()) as CardJitsuShopStateResponse
        setUserCandy(data.candy)
        setEquippedColorId(data.equippedColorId)
        setColors(data.colors)
        setPackInfo(data.pack)
      }

      if (profile && profile.cards) {
        setOwnedCards(profile.cards)
      }
    } catch (err) {
      console.warn('[DojoStore] Error loading shop data:', err)
      setError('Could not load Dojo Store at this time.')
    } finally {
      setLoading(false)
    }
  }, [runtime])

  useEffect(() => {
    void fetchShopData()
  }, [fetchShopData])

  // Buy a locked color
  const handleBuyColor = async (colorId: number): Promise<boolean> => {
    try {
      const payload: BuyColorPayload = { colorId }
      const res = await fetch('/api/card-jitsu/shop/buy-color', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        console.warn('[DojoStore] Purchase failed:', res.status)
        return false
      }

      const data = (await res.json()) as BuyColorResponse
      if (data.ok && data.candy !== undefined) {
        setUserCandy(data.candy)
        setEquippedColorId(colorId)
        setColors((prev) =>
          prev.map((c) => ({
            ...c,
            owned: c.id === colorId ? true : c.owned,
            equipped: c.id === colorId,
          })),
        )

        // Inform Card-Jitsu session
        if (runtime?.session) {
          runtime.session.setPlayerColor(colorId)
        }
        onColorEquipped?.(colorId)
        return true
      }
      return false
    } catch (err) {
      console.error('[DojoStore] Buy color error:', err)
      return false
    }
  }

  // Equip an already owned color
  const handleEquipColor = async (colorId: number): Promise<void> => {
    try {
      const payload: EquipColorPayload = { colorId }
      const res = await fetch('/api/card-jitsu/shop/equip-color', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        const data = (await res.json()) as EquipColorResponse
        if (data.ok) {
          setEquippedColorId(colorId)
          setColors((prev) =>
            prev.map((c) => ({
              ...c,
              equipped: c.id === colorId,
            })),
          )

          // Inform Card-Jitsu session
          if (runtime?.session) {
            runtime.session.setPlayerColor(colorId)
          }
          onColorEquipped?.(colorId)
        }
      }
    } catch (err) {
      console.error('[DojoStore] Equip color error:', err)
    }
  }

  // Buy Booster Pack -> triggers chest opening sequence
  const handleBuyPack = async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/card-jitsu/shop/buy-pack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      if (!res.ok) {
        console.warn('[DojoStore] Pack purchase failed:', res.status)
        return false
      }

      const data = (await res.json()) as BuyPackResponse
      if (data.ok && data.cards && data.cards.length === 10) {
        if (data.candy !== undefined) {
          setUserCandy(data.candy)
        }
        setActiveDrawnCards(data.cards)

        // Refresh Card-Jitsu engine deck
        if (runtime?.refreshProfile) {
          void runtime.refreshProfile().then((p) => {
            if (p && p.cards) {
              setOwnedCards(p.cards)
            }
          })
        }
        return true
      }
      return false
    } catch (err) {
      console.error('[DojoStore] Buy pack error:', err)
      return false
    }
  }

  if (loading && colors.length === 0) {
    return (
      <div className="dojo-store-loading" data-protected-image="true">
        <span className="dojo-loading-spinner" />
        <span>Loading Dojo Store...</span>
      </div>
    )
  }

  if (error && colors.length === 0) {
    return (
      <div className="dojo-store-error" data-protected-image="true">
        <span>{error}</span>
      </div>
    )
  }

  return (
    <section className="dojo-store-root" aria-label="Dojo Store" data-protected-image="true">
      {/* Header bar with Candy Balance */}
      {/* Header bar with Candy Balance */}
      <div className="dojo-store-header-bar">
        <div className="dojo-store-branding">
          <span className="dojo-store-title-icon">
            <svg className="dojo-store-title-svg" viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
              <path d="M2 4h20v3H2V4zm2 4h3v12H4V8zm13 0h3v12h-3V8zM8 9h8v2H8V9z"/>
            </svg>
          </span>
          <h2 className="dojo-store-heading">Dojo Store</h2>
        </div>
        <div className="dojo-candy-pill" title="Your Current Candy Balance">
          <span className="dojo-candy-icon">
            <svg className="dojo-candy-svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zm-6.29-.71c-.39-.39-1.02-.39-1.41 0l-2.59 2.59c-.39.39-.39 1.02 0 1.41l2.29 2.29c-.06-.52-.09-1.04-.09-1.58 0-1.74.55-3.35 1.48-4.68l-.4-.41c.24.26.49.5.72.78zm16.58 1.41l-2.59-2.59c-.39-.39-1.02-.39-1.41 0l-.4.41c.93 1.33 1.48 2.94 1.48 4.68 0 .54-.03 1.06-.09 1.58l2.29-2.29c.39-.39.39-1.02 0-1.41z"/>
            </svg>
          </span>
          <span className="dojo-candy-amount">{userCandy} Candy</span>
        </div>
      </div>

      {/* 2/3 (Left) vs 1/3 (Right) Real Estate Grid */}
      <div className="dojo-store-grid-layout">
        {/* Left 2/3: Pack Store & Chest Opening */}
        <div className="dojo-store-col-left">
          {activeDrawnCards ? (
            <ChestOpeningView
              cards={activeDrawnCards}
              onFinish={() => setActiveDrawnCards(null)}
              onOpenAnother={() => void handleBuyPack()}
              canOpenAnother={userCandy >= packInfo.price}
            />
          ) : (
            <PackStorePanel
              packInfo={packInfo}
              userCandy={userCandy}
              isOpening={false}
              onBuyPack={handleBuyPack}
            />
          )}
        </div>

        {/* Right 1/3: Colour Select (Top) & Owned Cards Browser (Bottom) */}
        <div className="dojo-store-col-right">
          <ColorSelectPanel
            colors={colors}
            equippedColorId={equippedColorId}
            userCandy={userCandy}
            onEquipColor={handleEquipColor}
            onBuyColor={handleBuyColor}
          />
          <OwnedCardsBrowser ownedCards={ownedCards} />
        </div>
      </div>
    </section>
  )
}
