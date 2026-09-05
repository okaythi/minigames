/**
 * Card-Jitsu Dojo Store Configuration
 *
 * Centralized, easily tunable variables for:
 * - Booster pack pricing and promotions
 * - Color pricing, promotions, and defaults
 * - Card rarity mappings (0 = normal, 100 = 0.01% drop rate)
 * - Pack rules (strictly 9 normal + 1 power, no repeats within a pack)
 * - Chest opening animation timings and particle effects
 */

export interface ColorProductConfig {
  readonly id: number
  readonly name: string
  readonly hex: string
  readonly price: number
  readonly originalPrice?: number // Renders e.g. "~~30~~ 20"
  readonly isPromoActive?: boolean
  readonly promoBadge?: string    // e.g. "-33%" or "HOT"
  readonly defaultUnlocked?: boolean
  readonly iconFile: string
}

export interface CardRaritySetting {
  /**
   * Rarity scale: 0 to 100.
   * 0 = normal uniform probability (weight = 1.0)
   * 100 = ultra-rare (0.01% relative chance, weight = 0.0001)
   * Weight formula: Math.pow(10, -4 * (rarity / 100))
   */
  readonly rarity: number
}

/**
 * Automatically calculates the discount percentage based on full price and actual price.
 * e.g., fullPrice = 80, actualPrice = 50 -> 38
 */
export function calculateDiscountPercent(fullPrice: number, actualPrice: number): number {
  if (fullPrice <= 0 || actualPrice >= fullPrice) return 0
  return Math.round(((fullPrice - actualPrice) / fullPrice) * 100)
}

export const DOJO_STORE_CONFIG = {
  // ==========================================
  // 1. BOOSTER PACK PRICING & PROMOTIONS
  // ==========================================
  pack: {
    /** Current cost in candy to purchase one booster pack */
    price: 50,
    /** Original non-discounted price shown with strikethrough when promo is active */
    originalPrice: 80,
    /** Whether the promotional discount is currently active */
    isPromoActive: true,
    /** Promotional tagline */
    promoTagline: 'LIMITED TIME DOJO DEAL',
    /** Name of the pack displayed in store */
    name: 'Card-Jitsu Booster Pack',
    /** Detailed pack guarantee description */
    description: 'Guaranteed 9 Combat Cards + 1 Epic Power Card. Every card in the pack is strictly unique.',
    /** Official Club Penguin booster deck icon */
    iconUrl: '/games/card-jitsu/assets/card-packs/booster-pack.png',
  },

  // ==========================================
  // 1b. FIRST PURCHASE PROMOTION
  // Applies strictly to the user's first ever card pack purchase
  // ==========================================
  firstPurchasePromo: {
    /** Baseline full price for the promo */
    fullPrice: 80,
    /** Special discounted price for the user's first pack purchase */
    actualPrice: 20,
    /** Tagline displayed on first purchase hero card */
    promoTagline: 'FIRST PACK WELCOME DEAL',
  },

  // ==========================================
  // 2. PACK COMPOSITION & DRAW INVARIANTS
  // ==========================================
  packRules: {
    /** Total cards dealt in a single pack opening */
    totalCards: 10,
    /** Number of non-power cards (powerId === 0) */
    normalCardsCount: 9,
    /** Number of power cards (powerId !== 0) */
    powerCardsCount: 1,
    /** Invariant: cards cannot repeat within the same pack draw */
    allowDuplicatesInPack: false,
  },

  // ==========================================
  // 3. CARD RARITY MAPPINGS (0..100)
  // ==========================================
  /**
   * Card ID -> Rarity setting.
   * Cards not listed here default to rarity: 0 (standard weight 1.0).
   * 100 = 0.01% chance (weight 0.0001).
   */
  cardRarity: {
    // Famous Power Cards
    73: { rarity: 80 },  // Jackhammer 3000 (Fire / Reversal)
    81: { rarity: 75 },  // Sled Racing (Snow / Reversal)
    89: { rarity: 80 },  // Firefighter (Water / Reversal)
    74: { rarity: 85 },  // Sensei's Fire
    82: { rarity: 85 },  // Sensei's Snow
    90: { rarity: 85 },  // Sensei's Water
    100: { rarity: 92 }, // Master Ninja Clash
    104: { rarity: 95 }, // Shadow Ninja
    120: { rarity: 90 }, // Elemental Storm
    200: { rarity: 88 }, // Golden Puffle
    300: { rarity: 90 }, // Ancient Dojo
    400: { rarity: 95 }, // Rainbow Puffle
    500: { rarity: 99 }, // Supreme Sensei (0.01% mythical)
  } as Record<number, CardRaritySetting>,

  // ==========================================
  // 4. COLOR PRICING & STORE CATALOG
  // ==========================================
  /** Base default price in candy for standard colors */
  defaultColorPrice: 20,

  /** All available Club Penguin colors */
  colors: [
    {
      id: 1,
      name: 'Blue',
      hex: '#003366',
      price: 0,
      defaultUnlocked: true,
      iconFile: '1.png',
    },
    {
      id: 2,
      name: 'Green',
      hex: '#009900',
      price: 20,
      originalPrice: 30,
      isPromoActive: true,
      promoBadge: '-33%',
      iconFile: '2.png',
    },
    {
      id: 3,
      name: 'Pink',
      hex: '#ff3399',
      price: 20,
      iconFile: '3.png',
    },
    {
      id: 4,
      name: 'Black',
      hex: '#333333',
      price: 20,
      originalPrice: 25,
      isPromoActive: true,
      promoBadge: 'POPULAR',
      iconFile: '4.png',
    },
    {
      id: 5,
      name: 'Red',
      hex: '#cc0000',
      price: 20,
      iconFile: '5.png',
    },
    {
      id: 6,
      name: 'Orange',
      hex: '#ff6600',
      price: 20,
      iconFile: '6.png',
    },
    {
      id: 7,
      name: 'Yellow',
      hex: '#ffcc00',
      price: 20,
      iconFile: '7.png',
    },
    {
      id: 8,
      name: 'Dark Purple',
      hex: '#660099',
      price: 20,
      iconFile: '8.png',
    },
    {
      id: 9,
      name: 'Brown',
      hex: '#996600',
      price: 20,
      iconFile: '9.png',
    },
    {
      id: 10,
      name: 'Peach',
      hex: '#ff6666',
      price: 20,
      iconFile: '10.png',
    },
    {
      id: 11,
      name: 'Dark Green',
      hex: '#006600',
      price: 20,
      originalPrice: 30,
      isPromoActive: true,
      promoBadge: 'SALE',
      iconFile: '11.png',
    },
    {
      id: 12,
      name: 'Light Blue',
      hex: '#0099cc',
      price: 20,
      iconFile: '12.png',
    },
    {
      id: 13,
      name: 'Lime Green',
      hex: '#8ae302',
      price: 20,
      originalPrice: 35,
      isPromoActive: true,
      promoBadge: 'VOTE WINNER',
      iconFile: '13.png',
    },
    {
      id: 15,
      name: 'Aqua',
      hex: '#02a797',
      price: 20,
      originalPrice: 30,
      isPromoActive: true,
      promoBadge: 'VOTE WINNER',
      iconFile: '15.png',
    },
    {
      id: 16,
      name: 'Arctic White',
      hex: '#e2e8f0',
      price: 25,
      originalPrice: 40,
      isPromoActive: true,
      promoBadge: 'HOLIDAY SPECIAL',
      iconFile: '16.png',
    },
  ] as readonly ColorProductConfig[],

  // ==========================================
  // 5. CHEST ANIMATION & AUDIO TIMINGS
  // ==========================================
  animation: {
    /** Duration in ms for the chest shaking/rumbling anticipation */
    chestWobbleDurationMs: 650,
    /** Number of particle sparkles emitted when the chest opens */
    burstParticleCount: 38,
    /** Interval in ms between flipping each normal card */
    normalCardFlipIntervalMs: 150,
    /** Dramatic suspense pause in ms before revealing the 10th power card */
    powerCardSuspenseMs: 700,
    /** Duration in ms for the power card golden aura expansion */
    powerCardGlowDurationMs: 1200,
    /** Enable synthesized Web Audio pentatonic chimes on chest burst and flips */
    enableWebAudio: true,
  },
} as const

/**
 * Calculates sampling weight for a given card ID using the rarity setting.
 * At rarity 0: weight = 1.0.
 * At rarity 100: weight = 0.0001 (0.01% relative chance).
 */
export function calculateCardWeight(cardId: number): number {
  const setting = DOJO_STORE_CONFIG.cardRarity[cardId]
  const rarity = setting !== undefined ? Math.min(100, Math.max(0, setting.rarity)) : 0
  return Math.pow(10, -4 * (rarity / 100))
}
