# Nixlabs Games — User Flags Bitmask Engine

This document provides the theoretical architecture, API specification, and integration guide for the **User Flags Bitmask Engine** on the Nixlabs Games platform.

---

## 1. Architectural Model: Bitmask / Bitset Vector

In high-performance networked applications, user account entitlements, roles, and dismissibles are evaluated frequently across edge workers, game loops, and UI components. Serializing and deserializing string dictionaries (e.g. `Record<string, FlagState>`) introduces significant JSON parsing, memory allocation, and GC overhead.

The Nixlabs platform uses a **Bitmask Vector model** (similar to the Discord permissions architecture and Linux file modes):

```
Bit Position:     Bit 3         Bit 2         Bit 1         Bit 0
Binary:             1             0             1             1
Value:              8             4             2             1
Flag:          CMS_EDITOR       STAFF     USER_PIONEER  USER_DEVELOPER
```

### Key Advantages
1. **O(1) Single-Cycle Evaluation**: Evaluation runs directly on the CPU register via bitwise AND (`flags & UserFlags.USER_DEVELOPER`).
2. **Compact Storage**: In Cloudflare D1 (SQLite), flags are stored as an **8-byte integer** (`INTEGER NOT NULL DEFAULT 0`) instead of variable-length JSON text.
3. **Compound Requirements**: Prerequisite checks for achievements, staff gates, and admin routes become single bitwise comparisons:
   ```ts
   const CMS_REQUIREMENT = UserFlags.STAFF | UserFlags.CMS_EDITOR
   const hasAccess = (user.flags & CMS_REQUIREMENT) === CMS_REQUIREMENT
   ```
4. **Wire Efficiency**: On the wire over HTTP and WebSockets, `user.flags` is sent as a compact number (e.g., `flags: 3`), eliminating serialization overhead.

---

## 2. Canonical Flag Definitions

Flag bits are declared in [shared/flags/types.ts](file:///c:/Users/thy/Projects/minigames/shared/flags/types.ts):

```ts
export const UserFlags = {
  NONE:           0,
  USER_DEVELOPER: 1 << 0, // Bit 0 (0001) = 1
  USER_PIONEER:   1 << 1, // Bit 1 (0010) = 2
  STAFF:          1 << 2, // Bit 2 (0100) = 4
  CMS_EDITOR:     1 << 3, // Bit 3 (1000) = 8
} as const

export type UserFlagsBit = (typeof UserFlags)[keyof typeof UserFlags]
export type UserFlags = number
```

> [!IMPORTANT]
> Because the repository enforces `isolatedModules: true` and `verbatimModuleSyntax: true`, flags are declared as a `const` object rather than a TypeScript `const enum`. This guarantees zero-cost numeric inlining while remaining 100% compatible with Vite and esbuild bundlers.

---

## 3. Compile-Time Word-Count Constraint ($\le$ 4 Words)

All flag descriptions in the metadata catalogue are strictly enforced by the TypeScript compiler using recursive template literal types:

```ts
type SplitWords<S extends string> =
  S extends `${infer Head} ${infer Tail}` ? [Head, ...SplitWords<Tail>] : [S]

type NonEmptyWords<T extends string[]> =
  T extends [infer Head, ...infer Tail extends string[]]
    ? Head extends '' ? NonEmptyWords<Tail> : [Head, ...NonEmptyWords<Tail>]
    : []

export type WordCount<S extends string> = NonEmptyWords<SplitWords<S>>['length']

export type MaxFourWords<T extends string> =
  WordCount<T> extends 1 | 2 | 3 | 4
    ? T
    : 'ERROR: Flag description must be 4 words or fewer'
```

If an engineer introduces a description with 5 or more words into `FLAGS_METADATA`:
```ts
// ❌ Compilation fails with TS2322
USER_TEST: defineFlag({
  description: 'This description contains too many words',
})
```

---

## 4. Pure Bitwise Helpers

Helpers are located in [shared/flags/helpers.ts](file:///c:/Users/thy/Projects/minigames/shared/flags/helpers.ts):

| Helper | Signature | Description |
| :--- | :--- | :--- |
| `hasFlag(flags, flag)` | `(flags: number, flag: UserFlagsBit \| string) => boolean` | Checks if a flag is active. Runs in 1 CPU cycle for bit constants. |
| `enableFlag(flags, flag)` | `(flags: number, flag: UserFlagsBit \| string) => number` | Returns vector with bit set (`flags \| bit`). |
| `disableFlag(flags, flag)` | `(flags: number, flag: UserFlagsBit \| string) => number` | Returns vector with bit cleared (`flags & ~bit`). |
| `hasAllFlags(flags, mask)` | `(flags: number, mask: number) => boolean` | Validates that all bits in mask are present (`(flags & mask) === mask`). |
| `hasAnyFlag(flags, mask)` | `(flags: number, mask: number) => boolean` | Validates that at least one bit in mask is present (`(flags & mask) !== 0`). |
| `parseFlags(raw)` | `(raw: unknown) => number` | Defensively coerces integers, numeric strings, and legacy JSON payloads. |

---

## 5. Separation of Concerns: Flags vs Badges vs Achievements

The platform strictly decouples flags from presentation and achievement logic:

```
┌──────────────────────────────────────────────────────────┐
│                   USER FLAGS ENGINE                      │
│  - Sole Responsibility: Stores & exposes integer bitmask │
│  - Zero knowledge of badge icons or achievement triggers │
└────────────────────────────┬─────────────────────────────┘
                             │
            ┌────────────────┴────────────────┐
            ▼                                 ▼
┌─────────────────────────┐       ┌─────────────────────────┐
│     PRESENTATION UI     │       │   ACHIEVEMENTS ENGINE   │
│  - Inspects user.flags  │       │  - Inspects user.flags  │
│  - Renders Developer    │       │  - Awards Pioneer badge │
│    or Staff Badges      │       │  - Developer flag does  │
│  - No engine coupling   │       │    NOT award badges     │
└─────────────────────────┘       └─────────────────────────┘
```

1. **User Flags**: Only exposes `user.flags: number`.
2. **Badges**: UI presentation layer evaluates `hasFlag(user.flags, UserFlags.USER_DEVELOPER)` to render `<DeveloperBadge />`.
3. **Achievements**: Evaluator ([functions/api/achievements/evaluator.ts](file:///c:/Users/thy/Projects/minigames/functions/api/achievements/evaluator.ts)) checks `hasFlag(stats.flags, UserFlags.USER_PIONEER)` to unlock `identity_lab_pioneer`. The developer flag intentionally does **not** trigger achievements.

---

## 6. How to Add a New Flag (in 2 Steps)

Adding a new platform flag requires no database migrations:

### Step 1: Declare the Bit in [shared/flags/types.ts](file:///c:/Users/thy/Projects/minigames/shared/flags/types.ts)
Pick the next available power of 2:
```ts
export const UserFlags = {
  NONE:           0,
  USER_DEVELOPER: 1 << 0, // 1
  USER_PIONEER:   1 << 1, // 2
  STAFF:          1 << 2, // 4
  CMS_EDITOR:     1 << 3, // 8
  VIP_PLAYER:     1 << 4, // 16 (NEW)
} as const
```

### Step 2: Add Metadata in [shared/flags/registry.ts](file:///c:/Users/thy/Projects/minigames/shared/flags/registry.ts)
Add the description (must be $\le$ 4 words):
```ts
export const FLAGS_METADATA = {
  // ...
  [UserFlags.VIP_PLAYER]: defineFlag({
    description: 'Arcade VIP Player',
  }),
} as const
```

That's it! Consumers can immediately check `hasFlag(user.flags, UserFlags.VIP_PLAYER)`.
