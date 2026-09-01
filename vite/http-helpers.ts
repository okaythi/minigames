import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  isFingerprint,
  isPlayerId,
  PLAYER_COOKIE_NAME,
  PLAYER_FINGERPRINT_HEADER,
  PLAYER_ID_HEADER,
  readCookie,
} from '../shared/player-cookie'
import { resolvePlayer, type ResolvedPlayer } from '../shared/resolve-player'
import type { StatsStore } from '../shared/stats-store'

export const MAX_BODY_BYTES = 2048

export const headerOf = (req: IncomingMessage, name: string): string | null => {
  const value = req.headers[name.toLowerCase()]
  return typeof value === 'string' ? value : null
}

export const sendJson = (
  res: ServerResponse,
  status: number,
  payload: unknown,
  cookie: string | null,
): void => {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  if (cookie !== null) {
    res.setHeader('set-cookie', cookie)
  }
  res.end(JSON.stringify(payload))
}

export const readBody = async (req: IncomingMessage, maxBytes = MAX_BODY_BYTES): Promise<string> => {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer: Buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))
    size += buffer.byteLength
    if (size > maxBytes) {
      throw new Error('payload too large')
    }
    chunks.push(buffer)
  }
  return Buffer.concat(chunks).toString('utf8')
}

export const parseJson = (raw: string): unknown => {
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}

export interface DevIdentity extends ResolvedPlayer {
  readonly fingerprint: string | null
}

const token = (value: string | null, valid: (candidate: string) => boolean): string | null =>
  value !== null && valid(value) ? value : null

export const identitySignals = async (
  req: IncomingMessage,
  store: StatsStore,
): Promise<DevIdentity> => {
  const fingerprint = token(headerOf(req, PLAYER_FINGERPRINT_HEADER), isFingerprint)
  const resolved = await resolvePlayer(
    {
      cookieId: token(readCookie(headerOf(req, 'cookie'), PLAYER_COOKIE_NAME), isPlayerId),
      storedId: token(headerOf(req, PLAYER_ID_HEADER), isPlayerId),
      fingerprint,
    },
    { byFingerprint: store.findPlayerByFingerprint },
  )
  return { ...resolved, fingerprint }
}
