# Card-Jitsu Infrastructure & Integration Guide

This document describes the architectural design, protocol specifications, AI policies, and external product integration interfaces for the Disney Card-Jitsu engine running on Nixlabs Minigames.

---

## 1. System Architecture Overview

Card-Jitsu operates as a hybrid architecture consisting of:
1. **Frontend Presentation Layer (`ruffle-stage.tsx` & `card.swf`)**:
   - Executes Disney's authentic ActionScript 2 Card-Jitsu engine (`card.swf`) compiled for Flash Player 9/10 within `@ruffle-rs/ruffle` (WebAssembly/WebGL).
   - An imperative shim bootstrap (`card_bootstrap.swf` compiled via MTASC) wraps Club Penguin's global objects (`SHELL`, `AIRTOWER`, `INTERFACE`, `ENGINE`).
   - Renders 760×480 vector art scaled to fit responsive 16:10 / 950×600 stage wrappers.
2. **TypeScript Virtual Server Layer (`session.ts`)**:
   - Replaces Club Penguin's Houdini Python SmartFoxServer gateway with an in-memory, zero-latency TypeScript simulation.
   - Maintains exact game state: hands, dealt card IDs, scored banks, active power buffs, elemental clashes, and round timers.
   - Enforces asynchronous, re-entrant-safe bridge dispatch between Flash's synchronous ActionScript message pumps and JavaScript's event loop.
3. **React Host Chrome & Template (`index.tsx`, `sensei-menu.tsx`)**:
   - Renders the authentic Disney start dialogue (Sensei on cushion with wooden plaques).
   - Defers mounting `<ruffle-player>` until explicit mode selection ("Earn your belts" or "Challenge Sensei"), providing the mandatory browser user gesture for background music autoplay.

---

## 2. External Product Integration Layer (Plugging Into the Game)

The game runtime is completely decoupled from the rendering chrome through the factory function `createCardJitsuRuntime`:

```ts
import { createCardJitsuRuntime } from '@/games/card-jitsu/runtime'
import { DefaultCardStore } from '@/games/card-jitsu/engine/deck/cards'
```

### 2.1 Factory Signature & Options

```ts
export interface CardJitsuRuntimeOptions {
  /** Player identity passed into the Flash engine */
  readonly player?: {
    readonly nick?: string         // Player username displayed in hand & mat
    readonly colorId?: number      // Club Penguin color index (1–15)
    readonly beltRank?: number     // 1 (White) through 9 (Black)
  }
  /** Custom inventory provider for owned cards */
  readonly cardStore?: CardStore
  /** Match mode: 'belts' (standard Dojo matchmaking) or 'sensei' (boss battle) */
  readonly mode?: 'sensei' | 'belts'
  /** Custom bot policy (defaults to belt-appropriate difficulty tier) */
  readonly opponentPolicy?: BotPolicy
  /** Asynchronous match end hook for ranking, rewards, and achievements */
  readonly onMatchEnd?: OnMatchEndCallback
  /** Callback when user exits the match back to product lobby */
  readonly onExit?: () => void
}
```

### 2.2 Influencing Player Customization

External products can dynamically configure every player attribute:

| Field | Range / Type | Purpose / Wire Impact |
|---|---|---|
| `nick` | `string` | Displayed above the player's 5 cards and in the match-end dialogue. Wire packet: `jz [0, nick, color, rank]`. |
| `colorId` | `1` to `15` | Sets the player penguin's body color in Flash: `1=Blue, 2=Green, 3=Pink, 4=Black, 5=Red, 6=Orange, 7=Yellow, 8=Purple, 9=Brown, 10=Peach, 11=Dark Green, 12=Light Blue, 13=Lime, 14=Sensei Gray, 15=Aqua`. |
| `beltRank` | `1` to `9` | Sets the player's current belt rank: `1=White, 2=Yellow, 3=Orange, 4=Green, 5=Blue, 6=Red, 7=Purple, 8=Brown, 9=Black`. Determines the belt asset worn by the player penguin on the mat. |
| `cardStore` | `CardStore` | Controls the pool of cards owned by the player. |

### 2.3 Custom Card Stores & Deck Manipulation

By default, players draw from `DefaultCardStore` (Starter Deck: 10 starter cards + 2 random power cards from the dealable media pool).
External products can implement the `CardStore` interface to inject booster pack cards, member cards, or custom unlocked decks:

```ts
export interface OwnedCard {
  readonly cardId: number       // 1 to 509 (must exist in dealable-ids.json)
  readonly quantity: number     // Total quantity owned
  readonly memberQuantity: number
}

export interface CardStore {
  getOwned(): readonly OwnedCard[]
}
```

**Example Custom Card Store**:
```ts
class CustomUserInventoryCardStore implements CardStore {
  constructor(private userCards: number[]) {}

  getOwned(): readonly OwnedCard[] {
    return this.userCards.map(id => ({
      cardId: id,
      quantity: 1,
      memberQuantity: 0
    }))
  }
}
```

*Safety Guarantee*: The engine validates owned cards against `DEALABLE_CARDS` (`dealable-ids.json`). Any cards lacking complete media (icon SWF or power animations) are filtered at session startup with a warning, preventing game-breaking clashing hangs.

---

## 3. Product Hooks: Match-End, Achievements, and Badges

When a match concludes, `session.ts` awaits the product's `onMatchEnd` callback before finalizing the Flash animation. This allows products to calculate XP, store persistent progression, award badges, and return reward instructions to Flash.

### 3.1 `MatchEndResult` Structure

```ts
export interface MatchEndResult {
  readonly winner: 'player' | 'opponent'
  readonly mode: 'belts' | 'sensei'
  readonly rounds: number
  readonly playerBank: readonly CardData[]      // Scored cards won by player
  readonly opponentBank: readonly CardData[]    // Scored cards won by opponent
  readonly winMethod: 'same-element' | 'three-elements' | 'no-cards' | 'forfeit'
  readonly flawless: boolean                   // True if opponent scored 0 cards
  readonly fullDojo: boolean                   // True if winner scored 9+ cards
  readonly senseiCardPlayed: boolean           // True if Sensei's card was played
}
```

### 3.2 Product Decision (`MatchEndDecision`)

The product returns a decision object to guide Flash's rewards:

```ts
export interface MatchEndDecision {
  /** Next belt rank (1–9) to award. Triggers Flash cza animation & belt item pop-up */
  readonly awardRank?: number
  /** Coins awarded (permanently 0; minigame does not award coins) */
  readonly coins?: number
}
```

### 3.3 Driving Achievements & Badges

External achievement engines can hook directly into `onMatchEnd`:

```ts
const runtime = createCardJitsuRuntime(deps, {
  onMatchEnd: async (result) => {
    // 1. Belt Progression
    let awardRank: number | undefined
    if (result.winner === 'player') {
      const userBelt = await db.getUserBelt(userId)
      if (userBelt < 9) {
        awardRank = userBelt + 1
        await db.setUserBelt(userId, awardRank)
        await badges.grant(userId, `BELT_${awardRank}`)
      }
    }

    // 2. Flawless Victory Badge
    if (result.winner === 'player' && result.flawless) {
      await badges.grant(userId, 'FLAWLESS_NINJA') // Beat opponent without losing a round
    }

    // 3. Element Specialist Badges
    if (result.winMethod === 'same-element') {
      const element = result.playerBank[0]?.element
      if (element === 'f') await badges.grant(userId, 'FIRE_TRIAD_MASTER')
      if (element === 'w') await badges.grant(userId, 'WATER_TRIAD_MASTER')
      if (element === 's') await badges.grant(userId, 'SNOW_TRIAD_MASTER')
    }

    // 4. Dojo Endurance Badge
    if (result.fullDojo) {
      await badges.grant(userId, 'DOJO_ENDURANCE') // 9+ cards on mat before win
    }

    // 5. Defeated Sensei Achievement
    if (result.mode === 'sensei' && result.winner === 'player') {
      await badges.grant(userId, 'SENSEI_CONQUEROR')
      await inventory.grant(userId, 104) // Ninja Mask (item 104; 4025 is White Belt)
    }

    return { awardRank, coins: 0 }
  },
  onExit: () => {
    router.navigate('/dojo')
  }
})
```

---

## 4. Artificial Intelligence Architecture

Card-Jitsu features two distinct AI systems: **Dojo Student Bot Opponents** (progressive belt tiers for "Earn your belts") and **Sensei** (the Master of the Dojo).

### 4.1 Dojo Student Bot Opponents (4 Difficulty Tiers & Roster)

Student bots represent other penguins training in the Dojo. In this implementation (product decision), bot matchmaking selects an opponent from the authentic student roster (`roster.json`) with belt rank equal to `min(playerBelt + 1, 9)`, authentic penguin colors, and tier-specific deck restrictions:
- **Tier 1 (White)**: Daffodaily5
- **Tier 2 (Yellow)**: Happy77, Businesmoose
- **Tier 3 (Orange)**: Graser8, Loustik005
- **Tier 4 (Green)**: Screenhog, Gajotz
- **Tier 5 (Blue)**: Pingit9, Akabob22
- **Tier 6 (Red)**: Oagalthorp, Commando717
- **Tier 7 (Purple)**: Ch4iz, Microdude9
- **Tier 8 (Brown)**: Trainman1405, Thinknoodles
- **Tier 9 (Black)**: Billybob, Rsnail, Watex, Saracontemporary

Bots operate across four progressive difficulty tiers (`src/games/card-jitsu/engine/ai/bot-policy.ts`):

```
+-------------------------------------------------------------------------+
|                        BOT DIFFICULTY TIERS                             |
+---------+--------------------+---------------+--------------------------+
| Tier    | Belts              | Policy Class  | Strategy                 |
+---------+--------------------+---------------+--------------------------+
| Tier 1  | White, Yellow      | UniformRandom | Uniform random choice.   |
| Tier 2  | Orange, Green, Blue| Greedy        | Element match + values.  |
|         |                    | (mistake=20%) | Blocks player win.       |
| Tier 3  | Red, Purple, Brown | OpponentModel | Frequency tracker.       |
|         |                    | (mistake=10%) | Counter-picks predicted. |
| Tier 4  | Black              | Expectimax    | Full 2-ply game tree.    |
|         |                    | (mistake=5%)  | Optimal state score.     |
+---------+--------------------+---------------+--------------------------+
```

#### Tier 1: `UniformRandomPolicy` (Belts 1–2: White, Yellow)
- Picks a random card uniformly from its dealable 5-card hand.
- Simulates early novice students learning the elemental rules.

#### Tier 2: `GreedyHeuristicPolicy` (Belts 3–5: Orange, Green, Blue)
- Computes immediate win potential:
  1. Checks if any card in hand completes a winning triad (3 same-element different-color, or 1 of each element all different colors).
  2. Checks if the player is one card away from winning, and prioritizes elements that counter the player's missing element.
  3. Otherwise, prefers higher card values and power cards.
- **Mistake Rate (20%)**: Has a 20% probability of lapsing into a random pick, providing realistic human error.

#### Tier 3: `OpponentModelPolicy` (Belts 6–8: Red, Purple, Brown)
- Tracks player choice history over the current match:
  - Builds an elemental frequency distribution (Fire, Water, Snow).
  - Predicts player's next move based on unfulfilled player triads.
  - Selects cards that counter the predicted element with highest win value.
- **Mistake Rate (10%)**: Highly disciplined, with only a 10% blunder rate.

#### Tier 4: `ExpectimaxPolicy` (Belt 9: Black Belt)
- Evaluates a 2-ply Expectimax search tree over all potential card clash matchups.
- Evaluates mat territory, blocker utility, card conservation, and power card multipliers.
- **Mistake Rate (5%)**: Plays nearly optimal tournament-level Card-Jitsu.

#### Human Realism Latency Delay
To prevent bot picks from appearing instantaneous and robotic, the engine introduces an asynchronous human latency delay:
- Uniform distribution between 400 ms and 1500 ms.
- The player's pick is broadcast immediately (`pick 0 <card>`), after which the bot "deliberates" before broadcasting its own pick (`pick 1 <card>`), matching authentic online player behavior.

---

## 5. Sensei's Two Distinct AIs

Sensei is the ancient guardian of the Dojo. In authentic Disney Card-Jitsu, Sensei does not use standard matchmaking—his AI depends entirely on whether the player has earned the Black Belt:

```
                      +-----------------------------+
                      |   PLAYER CHALLENGES SENSEI  |
                      +-----------------------------+
                                     |
                          [ Is player Black Belt? ]
                                    / \
                             NO    /   \   YES
                                  /     \
                                 v       v
                     +---------------+  +---------------------+
                     | MODE 1:       |  | MODE 2:             |
                     | Unbeatable    |  | Beat-Sensei Boss    |
                     | Teacher AI    |  | Fair Strategy AI    |
                     +---------------+  +---------------------+
```

### 5.1 Sensei Below Black Belt (Houdini: `ninja.py` L268–L278 pairing at deal)
- If player rank < 9 (Black Belt), Houdini pairs Sensei's hand at deal time using `get_win_card(player_card)` (`ninja.py` L270).
- For each dealt player card, Sensei is dealt a counter card that beats it by element (Fire > Snow, Snow > Water, Water > Fire), or has a higher value in the same element.

### 5.2 Sensei at Black Belt (Houdini: `ninja.py` L259–L264 uniform random deal)
- Once the player reaches rank 9 (Black Belt), Houdini sets `can_beat_sensei = True` and disables pairing: Sensei draws cards uniformly at random from the standard deck (`ninja.py` L260).
- Upon defeating Sensei at Black Belt, the Ninja Mask (Club Penguin item ID `104`) is awarded.

---

## 6. Flash Wire Protocol Reference

The table below summarizes the SmartFox wire packets exchanged between Flash and TypeScript:

| Packet | Direction | Arguments | Description |
|---|---|---|---|
| `gz` | Flash -> TS | `[roomId]` | Client requests game room initialization. |
| `gz` | TS -> Flash | `[maxPlayers, numPlayers]` | Acknowledges room; parameters `[2, 2]`. |
| `jz` | TS -> Flash | `[seat, nick, color, rank]` | Local player identity broadcast. Local player must be seat `0`. |
| `uz` | Flash -> TS | `""` | Client announces ready for opponent sync. |
| `uz` | TS -> Flash | `[p0_record, p1_record]` | Table occupancy records: `seat\|nick\|color\|rank`. |
| `sz` | TS -> Flash | `[]` | Game start trigger. Triggers ninja walk-in animation. |
| `deal` | Flash -> TS | `["deal", count]` | Flash requests dealt cards (initial 5, or 1 replacement). |
| `deal` | TS -> Flash | `[seat, ...cards]` | Deals cards: `dealtId\|cardId\|element\|val\|color\|power`. |
| `pick` | Flash -> TS | `["pick", cardSlot]` | Player clicked a card to pick. |
| `pick` | TS -> Flash | `[seat, cardSlot]` | Broadcasts pick confirmation to both seats. |
| `power`| TS -> Flash | `[seat, targetSeat, powerId]` | Broadcasts power card activation before clash. |
| `judge`| TS -> Flash | `[winnerSeat]` | Triggers clash battle animation (`0`=player, `1`=bot, `-1`=tie). |
| `czo`  | TS -> Flash | `[0, winnerSeat, ...ids]` | Match over (`0` = coins). Highlights winning triad cards on the mat. |
| `cza`  | TS -> Flash | `[rank]` | Belt awarded. Triggers Sensei award popup / ceremony. |
| `lz`   | Flash -> TS | `[]` | Player leaves match. |
| `cjsi` | TS -> Flash | `[]` | Stamp / achievement info response. |
