# FL Tron 3.0: Tactical Turbo Intelligence System

## 1. Overview
The Tactical Turbo Intelligence System governs offensive, defensive, and intercept boosts across the 6 difficulty levels of *FL Tron 3.0*. Rather than executing naive or arbitrary speed-ups, the system is driven by a multi-factor Expected Value (EV) engine, real-time player telemetry tracking, and a modular `TurboConfig` architecture.

---

## 2. Architecture & Modules

```
src/games/fl-tron-3/engine/ai/turbo/
├── types.ts          # Declarative TurboConfig, telemetry metrics, decision payloads
├── evaluators.ts      # Pure math & geometry evaluators (geometric cutoffs, Voronoi territory, pinch escape)
├── online-learner.ts  # Real-time player movement and turbo habit tracking
├── turbo-brain.ts     # Core valuation & decision orchestrator
└── index.ts           # Public module interface
```

---

## 3. The `TurboConfig` Interface

Every difficulty level is configured with a strongly-typed `TurboConfig` instance:

```typescript
export interface TurboConfig {
  /** Whether the AI is allowed to use turbos */
  readonly enabled: boolean
  /** Initial turbo allocation per round */
  readonly maxTurbos: number
  /** Whether turbo capacity is infinite (Level 6) */
  readonly infiniteTurbos: boolean
  /** Minimum Expected Value score (0-100) required to trigger */
  readonly activationThreshold: number
  /** Scarcity penalty coefficient as stock is consumed */
  readonly scarcityWeight: number
  /** Weight applied to geometric cutoff payoff */
  readonly cutoffWeight: number
  /** Weight applied to Voronoi territory expansion */
  readonly territoryWeight: number
  /** Level 5 special: instant reaction to player turbo */
  readonly alwaysCounterPlayerTurbo: boolean
  /** Minimum inter-burst cooldown interval (seconds) */
  readonly minCooldownSeconds: number
  /** Voronoi projection lookahead depth */
  readonly lookaheadSteps: number
}
```

---

## 4. Expected Value (EV) Decision Function

When evaluating a turbo opportunity:
1. **Geometric Cutoff Payoff ($S_{\text{cutoff}}$)**:
   - Calculates perpendicular and angled trajectory intersections.
   - Evaluates arrival times at normal speed ($D_{ai}$) vs accelerated turbo speed ($D_{ai} / 1.8$) relative to player arrival ($D_{p1}$).
   - Generates high payoff ($90$) when turbo converts a losing or tie race into a guaranteed cutoff before the player arrives.
2. **Territory Expansion Gain ($S_{\text{territory}}$)**:
   - Evaluates Voronoi partition delta with and without accelerated line placement.
3. **Scarcity Cost ($C_{\text{scarcity}}$)**:
   - Imposes an exponential penalty as stock diminishes:
     $$C_{\text{scarcity}} = w_{\text{scarcity}} \times \left(\frac{\text{maxTurbos} - \text{turbosLeft}}{\text{maxTurbos}}\right)^2 \times 25$$
4. **Total EV Score**:
   $$\text{Score} = w_{\text{cutoff}} \cdot S_{\text{cutoff}} + w_{\text{territory}} \cdot S_{\text{territory}} - C_{\text{scarcity}}$$
   Turbo triggers if and only if:
   $$\text{Score} \ge \text{activationThreshold} \quad \text{AND} \quad \text{Clear Runway} \ge 6 \text{ cells}$$

---

## 5. Difficulty Level Policies

| Level | Name | Stock | Policy & Behavioral Profile |
|:---:|:---|:---:|:---|
| **1** | Novice | 0 | `enabled: false`. No turbos. |
| **2** | Scout | 0 | `enabled: false`. No turbos. |
| **3** | Hunter | 2 | `enabled: false`. Possesses 2 turbos in reserve according to match rules, but never knows how to fire them. |
| **4** | Tactician | 3 | `enabled: true`. **Economical & Tactical**: Uses 3 turbos for high-payoff Voronoi territory control and geometric cutoffs. Scarcity scaling prevents wasteful spending on straight lines. |
| **5** | Assassin | 6 | `enabled: true`. **Obsessive Tailing & Counter-Boost**: Possesses 6 turbos. By design, instantly counter-boosts when the player uses turbo, plus fires timed 8s cutoff boosts. |
| **6** | Master Core | $\infty$ | `enabled: true`. **Supreme Cadence**: Infinite turbos with deep minimax lookahead and a strict 0.8s inter-turbo cooldown pacing. |

---

## 6. Real-Time Online Telemetry (`OnlinePlayerTracker`)

The AI continuously profiles player actions in real time:
- **`turnCount` & `straightRunRatio`**: Evaluates player turn predictability and tendency to commit to long corridors.
- **`playerAggressionScore`**: Quantifies the percentage of movement steps closing distance towards the AI vs fleeing to open chambers.
