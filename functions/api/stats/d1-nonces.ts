/// <reference types="@cloudflare/workers-types" />

export async function claimNonce(db: D1Database, nonce: string, now: number): Promise<boolean> {
  const result = await db
    .prepare('INSERT OR IGNORE INTO seen_nonces (nonce, seen_at) VALUES (?1, ?2)')
    .bind(nonce, now)
    .run()
  return result.meta.changes === 1
}

export async function pruneNonces(db: D1Database): Promise<void> {
  // A day of replay protection is plenty; the table must not grow forever.
  await db
    .prepare('DELETE FROM seen_nonces WHERE seen_at < ?1')
    .bind(Date.now() - 24 * 60 * 60 * 1000)
    .run()
}
