/**
 * Snowflake ID System — 64-bit monotonically increasing identifiers.
 *
 * Bit layout:
 * bit 63 ......................... 22 21 ........ 12 11 .......... 0
 * field: timestamp (42 bits)          creator (10 bits) sequence (12 bits)
 *
 * Stored in D1 / SQLite as a zero-padded 19-digit TEXT string to avoid
 * D1 client API 64-bit integer precision loss above 2^53.
 */

export const SNOWFLAKE_EPOCH_MS = Date.UTC(2026, 7, 10, 0, 0, 0) // 2026-08-10T00:00:00Z

const CREATOR_BITS = 10n
const SEQUENCE_BITS = 12n
const CREATOR_SHIFT = SEQUENCE_BITS                  // 12
const TIMESTAMP_SHIFT = SEQUENCE_BITS + CREATOR_BITS // 22
const MAX_CREATOR = (1n << CREATOR_BITS) - 1n        // 1023
const MAX_SEQUENCE = (1n << SEQUENCE_BITS) - 1n       // 4095

let lastMs = -1n
let sequence = 0n

/**
 * Live generator — call once per new user at signup.
 * Returns a zero-padded 19-digit decimal string.
 */
export function nextSnowflake(creatorId: number = 0): string {
  if (creatorId < 0 || BigInt(creatorId) > MAX_CREATOR) {
    throw new Error(`creatorId ${creatorId} exceeds 10-bit budget (max ${MAX_CREATOR})`)
  }
  let now = BigInt(Date.now()) - BigInt(SNOWFLAKE_EPOCH_MS)
  if (now === lastMs) {
    sequence = (sequence + 1n) & MAX_SEQUENCE
    if (sequence === 0n) {
      while (BigInt(Date.now()) - BigInt(SNOWFLAKE_EPOCH_MS) <= now) {
        // Spin wait to next ms
      }
      now = BigInt(Date.now()) - BigInt(SNOWFLAKE_EPOCH_MS)
    }
  } else {
    sequence = 0n
  }
  lastMs = now
  const id = (now << TIMESTAMP_SHIFT) | (BigInt(creatorId) << CREATOR_SHIFT) | sequence
  return id.toString().padStart(19, '0')
}

export interface DecodedSnowflake {
  readonly timestampMs: number
  readonly creatorId: number
  readonly sequence: number
}

/**
 * Decodes a 19-digit zero-padded or plain numeric snowflake string into components.
 */
export function decodeSnowflake(padded: string): DecodedSnowflake {
  const id = BigInt(padded)
  return {
    timestampMs: Number((id >> TIMESTAMP_SHIFT) + BigInt(SNOWFLAKE_EPOCH_MS)),
    creatorId: Number((id >> CREATOR_SHIFT) & MAX_CREATOR),
    sequence: Number(id & MAX_SEQUENCE),
  }
}

/**
 * Strip the storage padding for API / user display, matching Discord-style IDs.
 */
export function toDisplayId(padded: string): string {
  return BigInt(padded).toString()
}
