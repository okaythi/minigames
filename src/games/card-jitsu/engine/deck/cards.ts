import type { CardColor, CardData, NinjaElement } from '../../types'

const ELEMENTS: readonly NinjaElement[] = ['fire', 'water', 'snow']
const COLORS: readonly CardColor[] = ['red', 'blue', 'green', 'yellow', 'orange', 'purple']

/**
 * Generates the authentic Club Penguin Card-Jitsu standard card pool.
 */
export function generateStandardCardPool(): readonly CardData[] {
  const cards: CardData[] = []
  let id = 1

  // Standard cards (values 2 to 12 across all elements and colors)
  for (const element of ELEMENTS) {
    for (let value = 2; value <= 12; value++) {
      for (const color of COLORS) {
        // Certain cards are power cards (values 9-12 with special effects)
        let powerId = 0
        let name = `${element.toUpperCase()} ${value}`
        let description = `Standard ${element} card with value ${value}`

        if (value === 10) {
          powerId = 1 // Reverse value rule next turn
          name = `Power: Reverse ${element.toUpperCase()}`
          description = 'If same element clashes next round, lower value wins!'
        } else if (value === 11) {
          powerId = 2 // +2 buff
          name = `Power: +2 Boost ${element.toUpperCase()}`
          description = '+2 added to your card value next round'
        } else if (value === 12) {
          // Element blocker
          powerId = element === 'fire' ? 13 : element === 'water' ? 14 : 15
          name = `Power: Freeze Element`
          description = 'Locks opponent from playing counter element next round'
        }

        cards.push({
          id,
          element,
          value,
          color,
          powerId,
          name,
          description,
        })
        id++
      }
    }
  }

  return cards
}

export const ALL_CARDS: readonly CardData[] = generateStandardCardPool()

/**
 * Creates a balanced 20-card starter deck containing a fair spread of
 * Fire, Water, and Snow cards, including basic power cards.
 */
export function createStarterDeck(): CardData[] {
  const deck: CardData[] = [
    // Fire cards (7)
    { id: 101, element: 'fire', value: 3, color: 'red', powerId: 0, name: 'Hot Sauce' },
    { id: 102, element: 'fire', value: 5, color: 'orange', powerId: 0, name: 'Campfire' },
    { id: 103, element: 'fire', value: 6, color: 'yellow', powerId: 0, name: 'Lava Rock' },
    { id: 104, element: 'fire', value: 7, color: 'purple', powerId: 0, name: 'Dragon Breath' },
    { id: 105, element: 'fire', value: 8, color: 'blue', powerId: 0, name: 'Flamethrower' },
    { id: 106, element: 'fire', value: 10, color: 'red', powerId: 1, name: 'Reverse Fire', description: 'Low value wins next round' },
    { id: 107, element: 'fire', value: 11, color: 'orange', powerId: 2, name: 'Flame Boost', description: '+2 to next card' },

    // Water cards (7)
    { id: 201, element: 'water', value: 2, color: 'blue', powerId: 0, name: 'Water Balloon' },
    { id: 202, element: 'water', value: 4, color: 'green', powerId: 0, name: 'Submarine' },
    { id: 203, element: 'water', value: 6, color: 'yellow', powerId: 0, name: 'Surfer' },
    { id: 204, element: 'water', value: 7, color: 'purple', powerId: 0, name: 'Hydro Splash' },
    { id: 205, element: 'water', value: 8, color: 'red', powerId: 0, name: 'Tsunami Wave' },
    { id: 206, element: 'water', value: 10, color: 'blue', powerId: 1, name: 'Reverse Water', description: 'Low value wins next round' },
    { id: 207, element: 'water', value: 11, color: 'green', powerId: 2, name: 'Hydro Boost', description: '+2 to next card' },

    // Snow cards (6)
    { id: 301, element: 'snow', value: 3, color: 'green', powerId: 0, name: 'Snowball' },
    { id: 302, element: 'snow', value: 5, color: 'purple', powerId: 0, name: 'Icicle' },
    { id: 303, element: 'snow', value: 7, color: 'orange', powerId: 0, name: 'Snowboarder' },
    { id: 304, element: 'snow', value: 9, color: 'red', powerId: 0, name: 'Blizzard' },
    { id: 305, element: 'snow', value: 10, color: 'yellow', powerId: 1, name: 'Reverse Snow', description: 'Low value wins next round' },
    { id: 306, element: 'snow', value: 12, color: 'blue', powerId: 13, name: 'Blizzard Lock', description: 'Freeze element next round' },
  ]

  return shuffleDeck(deck)
}

/**
 * Creates Sensei's battle deck.
 */
export function createSenseiDeck(): CardData[] {
  const deck: CardData[] = [
    // High-level Sensei Fire cards
    { id: 501, element: 'fire', value: 4, color: 'red', powerId: 0, name: 'Sensei Tea' },
    { id: 502, element: 'fire', value: 6, color: 'orange', powerId: 0, name: 'Fire Staff' },
    { id: 503, element: 'fire', value: 8, color: 'yellow', powerId: 0, name: 'Volcano Core' },
    { id: 504, element: 'fire', value: 9, color: 'purple', powerId: 0, name: 'Phoenix Flare' },
    { id: 505, element: 'fire', value: 10, color: 'red', powerId: 1, name: 'Inversion Flame' },
    { id: 506, element: 'fire', value: 11, color: 'blue', powerId: 2, name: 'Grandmaster Spark' },
    { id: 507, element: 'fire', value: 12, color: 'yellow', powerId: 14, name: 'Dojo Conflagration' },

    // High-level Sensei Water cards
    { id: 601, element: 'water', value: 5, color: 'blue', powerId: 0, name: 'Tide Meditation' },
    { id: 602, element: 'water', value: 7, color: 'green', powerId: 0, name: 'Water Wheel' },
    { id: 603, element: 'water', value: 8, color: 'purple', powerId: 0, name: 'Mountain Stream' },
    { id: 604, element: 'water', value: 9, color: 'yellow', powerId: 0, name: 'Whirlpool' },
    { id: 605, element: 'water', value: 10, color: 'blue', powerId: 1, name: 'Current Inversion' },
    { id: 606, element: 'water', value: 11, color: 'orange', powerId: 2, name: 'Monsoon Surge' },
    { id: 607, element: 'water', value: 12, color: 'green', powerId: 15, name: 'Ocean Mist' },

    // High-level Sensei Snow cards
    { id: 701, element: 'snow', value: 4, color: 'green', powerId: 0, name: 'Bamboo in Snow' },
    { id: 702, element: 'snow', value: 6, color: 'purple', powerId: 0, name: 'Glacier Step' },
    { id: 703, element: 'snow', value: 8, color: 'orange', powerId: 0, name: 'Avalanche Fist' },
    { id: 704, element: 'snow', value: 9, color: 'red', powerId: 0, name: 'Frost Dragon' },
    { id: 705, element: 'snow', value: 10, color: 'yellow', powerId: 1, name: 'Absolute Zero' },
    { id: 706, element: 'snow', value: 12, color: 'blue', powerId: 13, name: 'Polar Vortex' },
  ]

  return shuffleDeck(deck)
}

export function shuffleDeck<T>(deck: readonly T[]): T[] {
  const result = [...deck]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = result[i]
    const swapTarget = result[j]
    if (temp !== undefined && swapTarget !== undefined) {
      result[i] = swapTarget
      result[j] = temp
    }
  }
  return result
}
