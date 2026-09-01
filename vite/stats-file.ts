import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { emptyStatsMemory, type StatsMemory } from '../shared/memory-store'
import { isFingerprint, isPlayerId } from '../shared/player-cookie'
import { parsePlayerRecord } from '../shared/player-record'
import {
  isRecordOfStats,
  parseGameStatsRecord,
  readField,
  type GameStatsRecord,
  type PlayerRecord,
} from '../shared/stats-protocol'

/**
 * The dev server's persistence layer: the same `StatsMemory` the fallback store
 * runs on, read from and written to a JSON file so `vite dev` keeps its numbers
 * across restarts the way D1 does.
 *
 * Everything coming off the disk goes through the shared parsers. The file is
 * editable, and hand-editing it is a normal thing to do while testing a bank
 * that is two thousand candy deep.
 */

const emptyMemory = (slugs: readonly string[]): StatsMemory => emptyStatsMemory(slugs)

const listOf = (value: unknown): readonly unknown[] => (Array.isArray(value) ? value : [])

const stringToken = (value: unknown, valid: (candidate: string) => boolean): string | null =>
  typeof value === 'string' && valid(value) ? value : null

export async function loadStatsMemory(
  filePath: string,
  slugs: readonly string[],
): Promise<StatsMemory> {
  const memory = emptyMemory(slugs)
  let parsed: unknown
  try {
    parsed = JSON.parse(await readFile(filePath, 'utf8')) as unknown
  } catch {
    return memory
  }
  if (!isRecordOfStats(parsed)) {
    return memory
  }

  const gamesRaw = readField(parsed, 'games')
  if (isRecordOfStats(gamesRaw)) {
    for (const [slug, entry] of Object.entries(gamesRaw)) {
      const record = parseGameStatsRecord(entry)
      if (record !== null) {
        memory.games.set(slug, record)
      }
    }
  }

  for (const entry of listOf(readField(parsed, 'players'))) {
    const player = parsePlayerRecord(entry)
    if (player !== null) {
      memory.players.set(player.id, player)
    }
  }

  const fingerprintsRaw = readField(parsed, 'fingerprints')
  if (isRecordOfStats(fingerprintsRaw)) {
    for (const [fingerprint, candidate] of Object.entries(fingerprintsRaw)) {
      const playerId = stringToken(candidate, isPlayerId)
      if (isFingerprint(fingerprint) && playerId !== null) {
        memory.fingerprints.set(fingerprint, playerId)
      }
    }
  }

  for (const nonce of listOf(readField(parsed, 'nonces'))) {
    if (typeof nonce === 'string' && nonce.length <= 64) {
      memory.nonces.add(nonce)
    }
  }
  return memory
}

export async function saveStatsMemory(filePath: string, memory: StatsMemory): Promise<void> {
  const games: Record<string, GameStatsRecord> = {}
  for (const [slug, record] of memory.games) {
    games[slug] = record
  }
  const players: PlayerRecord[] = [...memory.players.values()]
  const fingerprints: Record<string, string> = {}
  for (const [fingerprint, playerId] of memory.fingerprints) {
    fingerprints[fingerprint] = playerId
  }
  const shape = {
    games,
    players,
    fingerprints,
    nonces: [...memory.nonces],
  }
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(shape, null, 2)}\n`, 'utf8')
}
