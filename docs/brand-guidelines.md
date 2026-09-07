# Nixlabs Games — Brand Guidelines

This document defines the visual identity, colour palette, typography, design tokens, and aesthetic principles of Nixlabs Games.

---

## 1. Core Visual Philosophy

Nixlabs Games combines a clean, tactile paper-and-ink look with high-energy arcade accents.
The foundation rests on **warm off-white paper**, crisp dark ink typography, and **Cloudflare's vivid orange** (`#f6821f`), accented by precise geometric hairlines and arcade tokens. Pure white (`#ffffff`) is reserved strictly for elevated card surfaces, active badges, or high-contrast HUD elements.

---

## 2. Official Colour Palette

| Token | Hex | Role & Usage |
| :--- | :--- | :--- |
| `--nx-orange` | `#f6821f` | **Primary Brand Colour**: primary buttons, key accents, focus rings, wall teeth |
| `--nx-orange-bright` | `#fbad41` | Amber secondary accent, candy highlights, radiant stars |
| `--nx-orange-deep` | `#d96c12` | Deeper orange for hover states, badges, and progress counters |
| `--nx-orange-tint` | `#fdeadd` | Soft peach background tint for active tags and unlocked badge sockets |
| `--nx-paper` | `#faf7f2` | Primary page background (warm off-white, never cold `#ffffff`) |
| `--nx-card` | `#fffdf9` | Surface background for cards, modals, and passport panels |
| `--nx-sand` | `#f2ece2` | Subsurface dividers, borders, and recessed badge slots |
| `--nx-line` | `#e6e0d6` | Subtle structural hairlines and separator rules |
| `--nx-ink` | `#232324` | Primary body text, high-contrast headings, permanent obstacles |
| `--nx-slate` | `#6f6d6a` | Secondary text, descriptions, timestamps, locked badge borders |
| `--nx-graphite` | `#404041` | Neutral dark accent and outline strokes |
| `--nx-green` | `#1f9d5b` | Positive achievements, personal-best indicators, gems |
| `--nx-green-deep` | `#137742` | Deep forest green for rating text and success badges |
| `--nx-blue` | `#1f6fd1` | Informational accents, challenge links, links |
| `--nx-red` | `#d8433d` | Hazard red, floating spikes, destructive states |

### Implementation Mirrors
- **Web & CSS**: [`src/styles/tokens.css`](../src/styles/tokens.css)
- **Canvas 2D**: [`src/theme/palette.ts`](../src/theme/palette.ts) (hex mirror for immediate-mode renderers)

---

## 3. Typography

- **Primary Sans-Serif**: `system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
  - Used for titles, cards, navigation, and body copy.
  - Tracking is tight: `-0.022em` on headings for a punchy modern poster look.
- **Monospace**: `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`
  - Used for timestamps, arcade ratings, telemetry, streak counters, and technical readout stats.

---

## 4. Logo & Identity Marks

All brand vector assets are located in [`public/`](../public/):
- **Primary Logo Mark**: [`public/nixlabs-mark.svg`](../public/nixlabs-mark.svg) — Crisp geometric vector mark.
- **Favicon**: [`public/favicon.svg`](../public/favicon.svg) — Rounded tile version for tab bars and bookmarks.
- **Touch Icon**: [`public/apple-touch-icon.png`](../public/apple-touch-icon.png) — High-DPI mobile launcher icon.

---

## 5. Achievement & Badge Art Guidelines

All achievement iconography follows a **64×64 coordinate grid** structured into three semantic layers:
1. `<g id="background-chassis">`: Deterministic tier frames (Arcade Bronze, Precision Silver, Gold Legend, Cyber Hex, Dojo Medallion, Hazard Diamond).
2. `<g id="primary-emblem">`: Crisp, geometric vector symbols restricted to the `[16, 16, 48, 48]` inner safe bounding box.
3. `<g id="accent-highlights">`: Specular highlights, edge glints, and energetic particle accents.
