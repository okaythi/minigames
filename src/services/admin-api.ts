/**
 * Frontend Admin API Client.
 * Typed methods for interacting with NixLabs Admin Backend.
 */

export interface AdminUserListItem {
  readonly playerId: string
  readonly username: string
  readonly nickname: string | null
  readonly snowflakeId: string | null
  readonly displaySnowflakeId: string | null
  readonly flags: number
  readonly accountLocked: boolean
  readonly createdOn: number
  readonly lastLoggedIn: number | null
  readonly lastLoginIp: string | null
  readonly lastLoginIpIsVpn: boolean
  readonly registeredInCountry: string | null
}

export interface AdminUserDetail {
  readonly user: AdminUserListItem & { readonly pfpUrl: string | null }
  readonly notes: Array<{
    readonly id: number
    readonly targetPlayerId: string
    readonly authorPlayerId: string
    readonly body: string
    readonly createdAt: number
  }>
  readonly moderationActions: Array<{
    readonly id: number
    readonly targetPlayerId: string
    readonly actorPlayerId: string
    readonly actionType: 'ban' | 'mute' | 'friends_block' | 'warn'
    readonly reason: string
    readonly expiresAt: number | null
    readonly revokedAt: number | null
    readonly revokedBy: string | null
    readonly createdAt: number
  }>
  readonly sessions: Array<{
    readonly token: string
    readonly createdAt: number
    readonly expiresAt: number
    readonly revokedAt: number | null
    readonly userAgent: string | null
    readonly ipHash: string | null
    readonly isActive: boolean
  }>
  readonly reportsCount: number
  readonly openReportsCount: number
}

export interface ModerationReportItem {
  readonly id: string
  readonly reporterId: string
  readonly reporterUsername: string
  readonly reportedUserId: string
  readonly reportedUsername: string
  readonly messageId: string | null
  readonly reason: string
  readonly details: string | null
  readonly snapshotContext: string | null
  readonly status: 'open' | 'resolved'
  readonly reviewedByStaffId: string | null
  readonly resolutionAction: string | null
  readonly createdAt: number
  readonly resolvedAt: number | null
}

export interface AdminGameItem {
  readonly slug: string
  readonly title: string
  readonly source: unknown
  readonly defaultEnabled: boolean
  readonly status: 'published' | 'maintenance' | 'hidden'
  readonly flags: number
  readonly hasOverride: boolean
  readonly updatedBy: string | null
  readonly updatedAt: number | null
}

export interface PlatformMetadataResponse {
  readonly metadata: Record<string, { value: string | null; updatedBy: string | null; updatedAt: number }>
  readonly systemConfig: Record<string, number>
}

export interface AuditLogItem {
  readonly id: number
  readonly actorPlayerId: string
  readonly actorUsername: string
  readonly action: string
  readonly targetType: 'user' | 'game' | 'platform'
  readonly targetId: string | null
  readonly reason: string | null
  readonly metadata: any
  readonly createdAt: number
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text()
    try {
      const parsed = JSON.parse(text)
      throw new Error(parsed.error || `HTTP Error ${res.status}`)
    } catch {
      throw new Error(text || `HTTP Error ${res.status}`)
    }
  }
  return res.json() as Promise<T>
}

export async function fetchAdminUsers(params: {
  q?: string | undefined
  status?: string | undefined
  flag?: number | undefined
  limit?: number | undefined
  offset?: number | undefined
}): Promise<{ ok: boolean; users: AdminUserListItem[]; total: number }> {
  const query = new URLSearchParams()
  if (params.q) query.set('q', params.q)
  if (params.status) query.set('status', params.status)
  if (params.flag !== undefined) query.set('flag', String(params.flag))
  if (params.limit !== undefined) query.set('limit', String(params.limit))
  if (params.offset !== undefined) query.set('offset', String(params.offset))

  const res = await fetch(`/api/admin/users?${query.toString()}`)
  return handleResponse(res)
}

export async function fetchAdminUser(id: string): Promise<AdminUserDetail> {
  const res = await fetch(`/api/admin/users/${encodeURIComponent(id)}`)
  return handleResponse(res)
}

export async function applyModerationAction(
  id: string,
  payload: { actionType: string; reason: string; durationSeconds?: number | null | undefined },
): Promise<{ ok: boolean; actionId: number }> {
  const res = await fetch(`/api/admin/users/${encodeURIComponent(id)}/moderation-action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return handleResponse(res)
}

export async function liftModerationAction(
  id: string,
  payload: { actionId?: number | undefined; actionType?: string | undefined; reason: string },
): Promise<{ ok: boolean }> {
  const res = await fetch(`/api/admin/users/${encodeURIComponent(id)}/lift`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return handleResponse(res)
}

export async function addStaffNote(
  id: string,
  body: string,
): Promise<{ ok: boolean; note: unknown }> {
  const res = await fetch(`/api/admin/users/${encodeURIComponent(id)}/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body }),
  })
  return handleResponse(res)
}

export async function revokeUserSession(
  id: string,
  token: string,
): Promise<{ ok: boolean }> {
  const res = await fetch(
    `/api/admin/users/${encodeURIComponent(id)}/sessions/${encodeURIComponent(token)}/revoke`,
    {
      method: 'POST',
    },
  )
  return handleResponse(res)
}

export async function updateUserFlags(
  id: string,
  flags: number,
  reason?: string | undefined,
): Promise<{ ok: boolean; flags: number }> {
  const res = await fetch(`/api/admin/users/${encodeURIComponent(id)}/flags`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ flags, reason }),
  })
  return handleResponse(res)
}

export async function fetchModerationReports(params: {
  status?: string | undefined
  limit?: number | undefined
  offset?: number | undefined
}): Promise<{ ok: boolean; reports: ModerationReportItem[]; total: number }> {
  const query = new URLSearchParams()
  if (params.status) query.set('status', params.status)
  if (params.limit !== undefined) query.set('limit', String(params.limit))
  if (params.offset !== undefined) query.set('offset', String(params.offset))

  const res = await fetch(`/api/admin/users/moderation-reports?${query.toString()}`)
  return handleResponse(res)
}

export async function resolveModerationReport(
  reportId: string,
  payload: { resolutionAction: string; details?: string | undefined },
): Promise<{ ok: boolean }> {
  const res = await fetch(
    `/api/admin/users/moderation-reports/${encodeURIComponent(reportId)}/resolve`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  )
  return handleResponse(res)
}

export async function fetchAdminGames(): Promise<{ ok: boolean; games: AdminGameItem[] }> {
  const res = await fetch('/api/admin/games')
  return handleResponse(res)
}

export async function updateGameOverride(
  slug: string,
  payload: { status: string; flags: number; reason?: string | undefined },
): Promise<{ ok: boolean }> {
  const res = await fetch(`/api/admin/games/${encodeURIComponent(slug)}/override`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return handleResponse(res)
}

export async function fetchPlatformMetadata(): Promise<PlatformMetadataResponse> {
  const res = await fetch('/api/admin/platform/metadata')
  return handleResponse(res)
}

export async function updatePlatformMetadata(
  key: string,
  value: string,
  reason?: string | undefined,
): Promise<{ ok: boolean; key: string; value: string }> {
  const res = await fetch('/api/admin/platform/metadata', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value, reason }),
  })
  return handleResponse(res)
}

export async function fetchAuditLog(params: {
  actor?: string | undefined
  targetType?: string | undefined
  targetId?: string | undefined
  action?: string | undefined
  limit?: number | undefined
  offset?: number | undefined
}): Promise<{ ok: boolean; entries: AuditLogItem[]; total: number }> {
  const query = new URLSearchParams()
  if (params.actor) query.set('actor', params.actor)
  if (params.targetType) query.set('targetType', params.targetType)
  if (params.targetId) query.set('targetId', params.targetId)
  if (params.action) query.set('action', params.action)
  if (params.limit !== undefined) query.set('limit', String(params.limit))
  if (params.offset !== undefined) query.set('offset', String(params.offset))

  const res = await fetch(`/api/admin/platform/audit-log?${query.toString()}`)
  return handleResponse(res)
}
