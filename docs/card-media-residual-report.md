# Card-Jitsu Media Residual & Acquisition Report

**Target Objective**: Complete 509/509 Card Asset Inventory  
**Current Dealable Pool on Disk**: 238 cards with complete, cryptographically verified media  
**Wayback CDX Universe**: 150 unique card media assets captured across all Club Penguin subdomains  

---

## 1. Summary Overview

| Category | Total Required | Present & Valid on Disk | Missing From Disk | Captured in Wayback CDX |
|---|---|---|---|---|
| **Card Icons (`icons/{id}.swf`)** | 509 | 265 | 244 | 0 remaining (all 138 indexed captures retrieved) |
| **Power Attack SWFs (`pow_{id}_attack.swf`)** | 104 power cards | 28 | 76 | 0 uncaptured in CDX (`pow_427_attack.swf` retrieved) |
| **Power React SWFs (`pow_{id}_react.swf`)** | 104 power cards | 28 | 76 | 0 uncaptured in CDX (`pow_427_react.swf` retrieved) |
| **Fixed Battle Clashes (`f/s/w_attack/react.swf`)** | 6 | 6 | 0 | Complete |
| **Belt Award Ceremony (`award.swf`)** | 1 | 1 | 0 | Complete |

---

## 2. Missing Card Icons (244 Cards)

The following card IDs lack `icons/{id}.swf` on disk:

**Grouped ID Ranges**:
401, 501–584, 586–595, 601–644, 646–674, 676–696, 698–744, 746–750, 801–803

### CDX Evidence:
Wayback Machine CDX queries across all 10 Club Penguin subdomains (`media1...7`, `media`, `cdn`, `play`) returned **0 captures** for these IDs. The Wayback crawlers between 2008 and 2018 only recorded 138 numeric card icon URLs during incidental crawls.

---

## 3. Missing Power Card Battle Animations (76 Power Cards)

The authentic Disney Flash client dynamically loads `battles/pow_{id}_attack.swf` and `battles/pow_{id}_react.swf` when a power card is played during clash.

**Missing Power Card IDs**:
249–260, 349–360, 572–595, 724–750, 804

### Present Power Cards (28 IDs with complete verified dual SWFs):
IDs 71 through 97 (Original Disney Series 1 Power Cards) + Card 427.

### CDX Evidence:
Because Club Penguin loaded battle animations on demand via runtime ActionScript string concatenation (`"battles/pow_" + card.id + "_attack.swf"`), web crawlers never saw static HTML links to them. Only `pow_427` and fixed clashes (`f_attack`, `w_attack`, `s_attack`, `ambient`, `walk`, `tie`) were captured on Wayback.

---

## 4. Human Sourcing Recommendation (CPPS Media Packs)

To bridge the remaining cards from 238 to 509:
1. **Source**: A full Club Penguin Private Server (CPPS) media bundle (e.g. Club Penguin Rewritten / CPJourney / NewCP asset dump).
2. **Target Directories**:
   - `play/v2/games/card/icons/{1..509}.swf`
   - `play/v2/games/card/battles/pow_{id}_attack.swf`
   - `play/v2/games/card/battles/pow_{id}_react.swf`
3. **Safety Guarantee**: Once placed in `public/games/card-jitsu/card/`, running `npm run test:card-jitsu` and `node scripts/assert-card-jitsu-assets.mjs` will validate their SWF headers, reject placeholders, and automatically admit them into `dealable-ids.json`.
