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
  /** Temperature bias (0.0-1.0) overriding tier and roster defaults */
  readonly opponentTemperature?: number
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

### 2.3 Card Stores & D1 Persistence Synchronization

By default, the TypeScript runtime boots with [`DefaultCardStore`](file:///c:/Users/thy/Projects/minigames/src/games/card-jitsu/engine/deck/cards.ts#L54-L64) seeded from [`starter-deck.json`](file:///c:/Users/thy/Projects/minigames/src/games/card-jitsu/engine/deck/starter-deck.json) (12 cards: 9 normal cards and 3 power cards `[73, 81, 89]`).

Upon user authentication and profile load:
1. `GET /api/card-jitsu/profile` retrieves the user's authoritative card collection from Cloudflare D1 table `cj_card`.
2. The runtime forwards `profile.cards` to the active session via [`session.setOwnedCards(profile.cards)`](file:///c:/Users/thy/Projects/minigames/src/games/card-jitsu/engine/gateway/session.ts#L152-L158).
3. For special/test accounts like `@test`, all 509 cards (104 power cards + 405 normal cards) are injected directly into the session's dealing pool.
4. For new players, completing the Sensei dialogue triggers `POST /api/card-jitsu/intro-complete`, idempotently inserting the 12 starter cards into `cj_card` and granting inventory item `821`.

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

*Safety Guarantee*: The engine validates owned cards against `DEALABLE_CARDS` ([`dealable-ids.json`](file:///c:/Users/thy/Projects/minigames/src/games/card-jitsu/engine/deck/dealable-ids.json)). Any cards lacking complete media (icon SWF or power animations) are filtered at session startup with a warning, preventing game-breaking clashing hangs.


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

## 4. Artificial Intelligence Architecture & Decision Making

Card-Jitsu features two distinct AI systems: **Dojo Student Bot Opponents** (progressive belt tiers for "Earn your belts") and **Sensei** (the Master of the Dojo).

Implementation files:
- **Decision Policies**: [`src/games/card-jitsu/engine/ai/bot-policy.ts`](file:///c:/Users/thy/Projects/minigames/src/games/card-jitsu/engine/ai/bot-policy.ts)
- **Opponent Roster & Matchmaking**: [`src/games/card-jitsu/engine/opponents/roster.ts`](file:///c:/Users/thy/Projects/minigames/src/games/card-jitsu/engine/opponents/roster.ts)
- **Turn Scheduling & Bridge**: [`src/games/card-jitsu/engine/gateway/session.ts`](file:///c:/Users/thy/Projects/minigames/src/games/card-jitsu/engine/gateway/session.ts)

### 4.1 Dojo Student Bot Opponents (BOT_TIERS Matrix & Strategic Policy)

Student bots represent other penguins training in the Dojo. Matchmaking selects an opponent from the authentic student roster ([`roster.json`](file:///c:/Users/thy/Projects/minigames/src/games/card-jitsu/engine/opponents/roster.json)) with belt rank equal to $\min(\text{playerBelt} + 1, 9)$, authentic penguin colors, and tier-specific deck constraints defined authoritatively in [`tiers.ts`](file:///c:/Users/thy/Projects/minigames/src/games/card-jitsu/engine/opponents/tiers.ts):

- **Tier 1 (White)**: Daffodaily5
- **Tier 2 (Yellow)**: Happy77, Businesmoose
- **Tier 3 (Orange)**: Graser8, Loustik005
- **Tier 4 (Green)**: Screenhog, Gajotz
- **Tier 5 (Blue)**: Pingit9, Akabob22
- **Tier 6 (Red)**: Oagalthorp, Commando717
- **Tier 7 (Purple)**: Ch4iz, Microdude9
- **Tier 8 (Brown)**: Trainman1405, Thinknoodles
- **Tier 9 (Black)**: Billybob, Rsnail, Watex, Saracontemporary

#### BOT_TIERS Specification Matrix

```
+----+---------+-------+-------------+-------------------------------------------------------------------------------+
| Rk | Normal  | Power | Temperature | Policy Configuration                                                          |
+----+---------+-------+-------------+-------------------------------------------------------------------------------+
| 1  | starter |starter| 0.5         | UniformRandomPolicy (exact 12 starter IDs)                                    |
| 2  | 30      | 2     | 0.5         | UniformRandomPolicy                                                           |
| 3  | 40      | 4     | 0.5         | StrategicPolicy { precision: 0.6, horizon: 0, model: 0.00, powerAwareness: 0 }|
| 4  | 60      | 8     | 0.5         | StrategicPolicy { precision: 1.0, horizon: 0, model: 0.25, powerAwareness: 1 }|
| 5  | 90      | 15    | 0.5         | StrategicPolicy { precision: 1.5, horizon: 1, model: 0.50, powerAwareness: 1 }|
| 6  | 180     | 30    | 0.6         | StrategicPolicy { precision: 2.5, horizon: 1, model: 0.75, powerAwareness: 1 }|
| 7  | 180     | 60    | 0.5         | StrategicPolicy { precision: 4.0, horizon: 2, model: 1.00, powerAwareness: 2 }|
| 8  | 250     | 80    | 0.5         | StrategicPolicy { precision: 8.0, horizon: 2, model: 1.00, powerAwareness: 2 }|
| 9  | 320     | 100   | 0.5         | StrategicPolicy { precision: ∞,   horizon: 3, model: 1.00, powerAwareness: 2 }|
+----+---------+-------+-------------+-------------------------------------------------------------------------------+
```

#### Tier-Scaled Power Awareness (`powerAwareness: 0 | 1 | 2`)

| Level | Belts (Ranks) | Rules Model | Lookahead Search | Payoff & Pruning |
|---|---|---|---|---|
| **0 (Ignore)** | White–Orange (1–3) | Evaluates candidate cards with `BASE_RULES` (`RULE_SET`, identity element replacement, standard value comparison). | Ignores active modifiers entirely (`EMPTY_POWERS`). Power cards are evaluated as vanilla normal cards. | Discard powers and value limiters yield zero additional payoff. |
| **1 (Static 1-Step)** | Green–Red (4–6) | Clashes evaluated under `effectiveRules(activePowers, 1)`: Power 1 reverses same-element values only; the Fire → Snow → Water → Fire elemental order is unchanged. | Future plies do not advance powers; un-scored/future effects are approximated. | Scored power cards receive static $+0.5 \cdot \text{BASE}$ hold bonus; discard powers evaluate one-step potential delta $(\Phi(\text{opp}) - \Phi(\text{simOpp})) \cdot \frac{W_{\text{TRIAD}}}{2}$. |
| **2 (Full Search Advance)** | Purple–Black (7–9) | Full dynamic rules under `effectiveRules(activePowers, 1)`; Powers 16–18 change matching elements in their own round and do not persist. | Every search branch advances powers via pure `advancePowers(powers, played, scored)`. Next-round powers take effect in child nodes. | Discard planning, value-reversal sequencing, and bank vulnerability penalty ($-0.05 \cdot \text{maxConcentration}$) in Rank 9 tie-breaking. |

#### Unified `StrategicPolicy`
All ranks $\ge 3$ operate using a single parameterized `StrategicPolicy`:
1. **Immediate-Win Shortcut**: Immediately selects any card completing a winning triad (3 same-element distinct colors, or 3 distinct elements distinct colors).
2. **Opponent Element Modeling**:
   - Maintains a recency-weighted Dirichlet distribution over elements ($P(e)$, $\gamma = 0.7$, prior = 1 each).
   - Overlays rational opponent behavior weighted by `modelStrength`: predicts opponent will attempt to complete finishing triad elements if close to victory, or counter bot's potential finishing elements. Under `powerAwareness: 2`, rational candidate sets are mapped through `rules.replace` and `rules.beats`.
3. **Expectimax Lookahead**:
   - Searches up to `horizon` plies ahead ($W_{\text{TRIAD}} = 10$, $\text{BASE} = 1$, discount = 0.9/ply).
   - Incorporates bank potential flexibility $\Phi \in [0, 1]$ and full discard power card simulation via pure `applyPowerToBanks`.
   - Evaluates same-element outcomes using precomputed value CDFs adjusted by active `valueDelta` and `lowestWins`.
4. **Action Selection**:
   - Softmax selection: $P(c) \propto \exp(\text{precision} \cdot U(c))$.
   - Rank 9 ($\text{precision} = \infty$): Argmax with bank vulnerability penalty ($-0.05 \cdot \text{maxConcentration}$) tie-breaker among moves within $\varepsilon = 0.05$ of maximum expected utility.

#### Fairness Guarantee
Dojo student bots receive **zero information** regarding the player's hand or unresolved pick:
- The immutable `BotContext` type contains only the bot's own hand, public banks, resolved round history, active powers, round number, and seeded PRNG.
- `playerDealtMap`, `oppHand`, and `playerSelectedCard` are strictly absent from the AI boundary and verified by automated static analysis.
- The player's picked card is only pushed to history *after* the bot has finalized and committed its pick.
- Opponent power cards are unobservable until clash; the bot models only powers already resolved into `activePowers`.

#### Human Realism Latency Delay
To prevent bot picks from appearing instantaneous and robotic, [`session.ts`](file:///c:/Users/thy/Projects/minigames/src/games/card-jitsu/engine/gateway/session.ts) introduces an asynchronous deliberation delay:
- Uniform random distribution between 400 ms and 1500 ms.
- The player's pick is broadcast immediately (`pick 1 <cardSlot>`), after which the bot "deliberates" before broadcasting its own pick (`pick 0 <cardSlot>`), matching authentic online player interaction.

---

## 5. Sensei's Dual AI Modes

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

Implementation files:
- **Sensei Deal Pairing**: [`src/games/card-jitsu/engine/deal/deal-strategy.ts`](file:///c:/Users/thy/Projects/minigames/src/games/card-jitsu/engine/deal/deal-strategy.ts)
- **Sensei Move Dispatch**: [`src/games/card-jitsu/engine/gateway/session.ts`](file:///c:/Users/thy/Projects/minigames/src/games/card-jitsu/engine/gateway/session.ts)

### 5.1 Mode 1: Sensei Below Black Belt (Unbeatable Teacher)
- **Houdini Reference**: `ninja.py` L268–L278 pairing at deal.
- When `playerRank < 9`:
  1. **Pre-Clash Hand Pairing**: During deal execution ([`executeDealRound`](file:///c:/Users/thy/Projects/minigames/src/games/card-jitsu/engine/deal/deal-strategy.ts#L100-L125)), Sensei's hand is generated by pairing every dealt player card to a counter card via [`getSenseiCounterCard(playerCard, usedColors)`](file:///c:/Users/thy/Projects/minigames/src/games/card-jitsu/engine/deal/deal-strategy.ts#L63-L77).
  2. **Guaranteed Counter**: The counter card beats the player card by element (Fire > Snow, Snow > Water, Water > Fire), or has a higher numeric value in the same element.
  3. **Instant Lookup Move**: When the player picks a card, Sensei resolves the mapped move immediately from `senseiMoveMap.get(playerDealtId)`.
  4. **Power Card Lockout**: In [`drawPlayerCards()`](file:///c:/Users/thy/Projects/minigames/src/games/card-jitsu/engine/deal/deal-strategy.ts#L26-L61), all power cards (`powerId !== 0`) in the player's inventory are excluded from deal when `isSensei && !canBeatSensei`.

### 5.2 Mode 2: Sensei at Black Belt (Fair Beat-Sensei Boss)
- **Houdini Reference**: `ninja.py` L259–L264 uniform random deal.
- When `playerRank >= 9` (Black Belt):
  1. **Unpaired Fair Deal**: `canBeatSensei` becomes `true`. Sensei's hand is dealt uniformly at random from `DEALABLE_CARDS`.
  2. **Power Cards Unlocked**: The player is permitted to draw and play all power cards against Sensei.
  3. **Competitive Policy**: Sensei evaluates turns using `ExpectimaxPolicy` without knowing the player's pick ahead of time.
  4. **Ninja Mask Award**: Defeating Sensei at Black Belt awards Rank 10 (Ninja Master) and grants the Ninja Mask (Club Penguin item ID `104`).

### 5.3 Progression Invariant: Training Progress from Sensei Losses
- **Training XP**: A Sensei win below Black Belt awards the challenger **+1 XP**, matching Houdini's `ninja_progress(p, won=False)` path. This can award a coloured belt when an XP threshold is reached.
- **Master Advancement**: Defeating Sensei at Rank 9 (Black Belt) in `sensei` mode awards Rank 10 (Ninja Master) with progress unchanged. Below Black Belt, the counter-deal prevents a normal player victory, so there is no win-based rank shortcut.

---

## 6. Card Dealing Subsystem (Player & AI)

Card dealing is strictly partitioned between player inventory management and bot deck composition:

Implementation files:
- **Deal Algorithms**: [`src/games/card-jitsu/engine/deal/deal-strategy.ts`](file:///c:/Users/thy/Projects/minigames/src/games/card-jitsu/engine/deal/deal-strategy.ts)
- **Card Data & Inventory Stores**: [`src/games/card-jitsu/engine/deck/cards.ts`](file:///c:/Users/thy/Projects/minigames/src/games/card-jitsu/engine/deck/cards.ts)
- **Dealable Catalog & Assets**: [`src/games/card-jitsu/engine/deck/cards.json`](file:///c:/Users/thy/Projects/minigames/src/games/card-jitsu/engine/deck/cards.json) & [`dealable-ids.json`](file:///c:/Users/thy/Projects/minigames/src/games/card-jitsu/engine/deck/dealable-ids.json)

### 6.1 Player Card Deal (`drawPlayerCards`)

```ts
export function drawPlayerCards(
  store: CardStore,
  currentHand: readonly CardData[],
  count: number,
  isSensei: boolean,
  canBeatSensei: boolean,
): DealableCard[]
```

1. **Inventory Accumulation**: Gathers all owned cards from `store.getOwned()`. Card counts are weighted by `quantity + memberQuantity`.
2. **Media Asset Validation**: Ignores any card ID not in `DEALABLE_IDS` (all 509 catalog cards are verified dealable).
3. **Sensei Power Gate**: If `isSensei && !canBeatSensei`, cards with `powerId !== 0` are excluded.
4. **Hand Reservation**: Subtracts cards currently in the player's 5-card hand so duplicates do not exceed owned quantities.
5. **Sampling Without Replacement**: Randomly samples `count` cards (5 on round 1; 1 on subsequent rounds) from the expanded deck pool.
6. **Fallback**: If the player's owned pool is completely exhausted, draws from verified `DEALABLE_CARDS`.

### 6.2 Dojo Bot Card Deal (`BotDeck` & Temperature Dealing)

Bot card pools are managed dynamically per match by [`BotDeck`](file:///c:/Users/thy/Projects/minigames/src/games/card-jitsu/engine/opponents/bot-deck.ts):

1. **Rank-Driven Pool Partition**:
   - `NORMAL_POOL` (405 cards with `powerId === 0`) and `POWER_POOL` (104 cards with `powerId !== 0`) partition the 509 dealable catalog.
   - For Rank 1, the deck is fixed to the exact 12 starter deck cards (9 normal, 3 power).
   - For Ranks 2–9, the deck draws $N_{\text{normal}}$ and $N_{\text{power}}$ cards uniformly from the pools at match start per `BOT_TIERS`.
2. **Temperature-Biased Dealing**:
   - Card dealing is biased according to value-normalized temperature $\tau \in [0.0, 1.0]$:
     $$\text{weight}(c) = \exp\left(\text{TEMPERATURE\_SHARPNESS} \cdot (2\tau - 1) \cdot (w - 0.5)\right)$$
     where $\text{TEMPERATURE\_SHARPNESS} = 4$ and $w = \frac{\text{value}(c) - \min(V)}{\max(V) - \min(V)} \in [0, 1]$.
   - At $\tau = 0.5$, weights are uniform ($1.0$).
   - At $\tau = 1.0$, top-value cards have $\approx e^4 \approx 54.6\times$ higher probability of being dealt.
   - At $\tau = 0.0$, low-value cards are heavily preferred.
3. **Sampling Without Replacement**:
   - Draws use the Efraimidis–Spirakis algorithm (`weightedSample` in [`cards.ts`](file:///c:/Users/thy/Projects/minigames/src/games/card-jitsu/engine/deck/cards.ts)) computing keys $k_i = u_i^{1/w_i}$ with uniform random $u_i \in (0, 1]$.
4. **Drawdown Semantics**:
   - Drawn cards are removed from the deck without replacement across rounds.
   - If the deck is completely exhausted during an extended match, it automatically calls `reset()` to refill and shuffle from the tier configuration.

---

## 7. Server-Authoritative Progression & Cloudflare D1 Architecture

Card-Jitsu state is fully server-authoritative and persisted in Cloudflare D1 via Drizzle ORM:

### 7.1 Database Schema (`src/db/schema.ts`)
- **`cj_ninja`**: `user_id` (PK), `rank` (0–10), `progress` (absolute exp), `matches_won`, `color_id`, `intro_seen`, `updated_at`.
- **`cj_card`**: `user_id`, `card_id`, `quantity`, `member_quantity` (composite PK: `user_id` + `card_id`).
- **`cj_match`**: Audit history logging `id`, `user_id`, `opponent`, `mode`, `winner`, `rounds`, `win_method`, `flawless`, `full_dojo`, `rank_before`, `rank_after`, `progress_before`, `progress_after`, `created_at`.

### 7.2 API Endpoints
- **`GET /api/card-jitsu/profile`**: Returns ninja rank, progress, color, intro state, owned cards, and dynamically computed `eligibleOpponents`.
- **`POST /api/card-jitsu/intro-complete`**: Persists intro completion and grants the starter deck (`[1, 6, 9, 14, 17, 20, 22, 23, 26, 73, 81, 89]`).
- **`POST /api/card-jitsu/match`**: Idempotent match progression execution (`applyMatchProgression`). Standard Dojo wins award +5 XP and losses +1 XP; Sensei losses below Black Belt award +1 training XP, and a Black-Belt Sensei win awards Ninja Master. The response includes the actual `progressAwarded` receipt and any `awardRank`.
- **`POST /api/card-jitsu/color`**: Updates penguin body color.

### 7.3 Experience & Threshold Formula
Progression uses authentic Club Penguin Houdini mathematics ([`shared/progression.ts`](file:///c:/Users/thy/Projects/minigames/shared/progression.ts)):
$$\text{threshold}(r) = \frac{(r + 1) \cdot r}{2} \times 5$$

- Rank 1 (White): 5 exp
- Rank 2 (Yellow): 15 exp
- Rank 3 (Orange): 30 exp
- Rank 4 (Green): 50 exp
- Rank 5 (Blue): 75 exp
- Rank 6 (Red): 105 exp
- Rank 7 (Purple): 140 exp
- Rank 8 (Brown): 180 exp
- Rank 9 (Black): 225 exp
- Rank 10 (Master): Defeat Sensei at Rank 9 in `sensei` mode.

### 7.4 Live Belt HUD (`BeltHud`)
Rendered directly below the Flash stage in [`src/games/card-jitsu/components/belt-hud.tsx`](file:///c:/Users/thy/Projects/minigames/src/games/card-jitsu/components/belt-hud.tsx):
- **Current Belt Badge**: 48×48px PNG + belt name.
- **Continuous Progress Pill**: Seamless connector track spanning between current and next belts (`flex: 1`, `maxWidth: 480px`, `height: 16px`, fill: `var(--nx-orange, #f6821f)`).
- **Next Belt Badge**: 48×48px PNG + next belt name.
- **Zero "x/y to next" text** and **no literal arrows**.

---

## 8. Flash Wire Protocol Reference

The table below summarizes the SmartFox wire packets exchanged between Flash and TypeScript ([`packets.ts`](file:///c:/Users/thy/Projects/minigames/src/games/card-jitsu/engine/protocol/packets.ts)):

> **Seat Conventions**: Local Player is **Seat 1** (`PLAYER_SEAT`), Opponent/Bot is **Seat 0** (`OPP_SEAT`), and Tie is **Seat -1** (`TIE_SEAT`).

| Packet | Direction | Arguments | Description |
|---|---|---|---|
| `gz` | Flash -> TS | `[roomId]` | Client requests game room initialization. |
| `gz` | TS -> Flash | `[maxPlayers, numPlayers]` | Acknowledges room; parameters `[2, 2]`. |
| `jz` | TS -> Flash | `[seat, nick, color, rank]` | Player identity broadcast for seat 1 (`PLAYER_SEAT`). |
| `uz` | Flash -> TS | `""` | Client announces ready for opponent sync. |
| `uz` | TS -> Flash | `[p0_record, p1_record]` | Table occupancy records: `seat\|nick\|color\|rank` for seats 0 and 1. |
| `sz` | TS -> Flash | `[]` | Game start trigger. Initiates ninja walk-in animation. |
| `deal` | Flash -> TS | `["deal", count]` | Flash requests dealt cards (initial 5, or 1 replacement). |
| `deal` | TS -> Flash | `[seat, ...cards]` | Deals cards: `dealtId\|cardId\|element\|val\|color\|power`. |
| `pick` | Flash -> TS | `["pick", cardSlot]` | Player clicked a card slot to pick. |
| `pick` | TS -> Flash | `[seat, cardSlot]` | Broadcasts pick confirmation to both seats. |
| `power`| TS -> Flash | `[seat, targetSeat, powerId]` | Broadcasts power card activation before clash. |
| `judge`| TS -> Flash | `[winnerSeat]` | Triggers clash battle animation (`1`=player, `0`=bot, `-1`=tie). |
| `czo`  | TS -> Flash | `[0, winnerSeat, ...ids]` | Match over (`0` = coins). Highlights winning triad cards on the mat. |
| `cza`  | TS -> Flash | `[rank]` | Belt awarded. Triggers Sensei `award.swf` ceremony. |
| `lz`   | Flash -> TS | `[]` | Player leaves match back to Dojo. |
| `cjsi` | TS -> Flash | `[]` | Stamp / achievement info response. |

