import { drizzle } from 'drizzle-orm/d1'
import { userNotifications } from '../../../../src/db/schema'

export interface CreateNotificationParams {
  readonly playerId: string
  readonly type: 'moderation' | 'warning' | 'account' | 'system'
  readonly title: string
  readonly body: string
}

export async function dispatchUserNotification(
  db: ReturnType<typeof drizzle>,
  params: CreateNotificationParams,
): Promise<void> {
  try {
    await db.insert(userNotifications).values({
      playerId: params.playerId,
      type: params.type,
      title: params.title,
      body: params.body,
      createdAt: Date.now(),
    })
  } catch (err) {
    console.error('[dispatchUserNotification] failed:', err)
  }
}
