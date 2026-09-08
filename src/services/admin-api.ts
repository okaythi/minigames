/**
 * Frontend Admin API Client.
 * Typed methods for interacting with NixLabs Admin Backend.
 */

export type * from './admin-types'
import type {
  AdminUserDetail,
  ModerationReportItem,
  AdminGameItem,
  PlatformMetadataResponse,
  AuditLogItem,
  AdminUsersResponse,
} from './admin-types'
import { triggerSessionRevoked } from './auth-api'

export class CloudflareAccessRequiredError extends Error {
  constructor(message = 'Cloudflare Zero Trust authentication required. Please reload the page.') {
    super(message)
    this.name = 'CloudflareAccessRequiredError'
  }
}

export function isCloudflareAccessError(err: unknown): boolean {
  if (err instanceof CloudflareAccessRequiredError) return true
  if (err instanceof Error) {
    const msg = err.message.toLowerCase()
    return (
      msg.includes('cloudflare') ||
      msg.includes('zero trust') ||
      msg.includes('failed to fetch') ||
      msg.includes('access required')
    )
  }
  return false
}

async function adminFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init)
  } catch (err: unknown) {
    // A CORS error typically occurs when Cloudflare Zero Trust attempts to redirect
    // an unauthenticated AJAX fetch request to the external Access login URL.
    if (err instanceof TypeError && err.message.includes('fetch')) {
      throw new CloudflareAccessRequiredError(
        'Cloudflare Zero Trust authentication required or network request blocked. Please reload the page to log in.',
      )
    }
    throw err
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  const contentType = res.headers.get('content-type') || ''
  const isHtml = contentType.includes('text/html')

  if (isHtml) {
    // Cloudflare Zero Trust challenges or login pages are returned as HTML
    throw new CloudflareAccessRequiredError(
      'Cloudflare Zero Trust login session required. Please reload the page to authenticate.',
    )
  }

  const text = await res.text()
  let parsed: any = null
  try {
    parsed = JSON.parse(text)
  } catch {
    if (text.includes('<!doctype') || text.includes('<html') || text.includes('Cloudflare')) {
      throw new CloudflareAccessRequiredError(
        'Cloudflare Zero Trust session required. Please reload the page to authenticate.',
      )
    }
    if (!res.ok) {
      throw new Error(text || `HTTP Error ${res.status}`)
    }
    throw new Error('Invalid JSON response from server')
  }

  if (!res.ok) {
    if (res.status === 401) {
      // Only revoke application session if it is genuinely the Nixlabs backend stating
      // that the user session is expired or invalid
      const errorMsg = typeof parsed?.error === 'string' ? parsed.error : ''
      if (
        errorMsg.toLowerCase().includes('session') ||
        errorMsg.toLowerCase().includes('unauthorized') ||
        errorMsg.toLowerCase().includes('locked')
      ) {
        triggerSessionRevoked()
      }
    }
    throw new Error(parsed?.error || `HTTP Error ${res.status}`)
  }

  return parsed as T
}

export async function fetchAdminUsers(params: {
  q?: string | undefined
  status?: string | undefined
  flag?: number | undefined
  limit?: number | undefined
  offset?: number | undefined
}): Promise<AdminUsersResponse> {
  const query = new URLSearchParams()
  if (params.q) query.set('q', params.q)
  if (params.status) query.set('status', params.status)
  if (params.flag !== undefined) query.set('flag', String(params.flag))
  if (params.limit !== undefined) query.set('limit', String(params.limit))
  if (params.offset !== undefined) query.set('offset', String(params.offset))

  const res = await adminFetch(`/api/admin/users?${query.toString()}`)
  return handleResponse(res)
}

export async function fetchAdminUser(id: string): Promise<AdminUserDetail> {
  const res = await adminFetch(`/api/admin/users/${encodeURIComponent(id)}`)
  return handleResponse(res)
}

export async function applyModerationAction(
  id: string,
  payload: { actionType: string; reason: string; durationSeconds?: number | null | undefined },
): Promise<{ ok: boolean; actionId: number }> {
  const res = await adminFetch(`/api/admin/users/${encodeURIComponent(id)}/moderation-action`, {
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
  const res = await adminFetch(`/api/admin/users/${encodeURIComponent(id)}/lift`, {
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
  const res = await adminFetch(`/api/admin/users/${encodeURIComponent(id)}/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body }),
  })
  return handleResponse(res)
}

export async function revokeUserSession(
  id: string,
  token: string,
): Promise<{ ok: boolean; isCurrentSessionRevoked?: boolean }> {
  const res = await adminFetch(
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
  const res = await adminFetch(`/api/admin/users/${encodeURIComponent(id)}/flags`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ flags, reason }),
  })
  return handleResponse(res)
}

export interface UpdateUserProfilePayload {
  readonly username?: string | undefined
  readonly nickname?: string | null | undefined
  readonly nicknameChangedCount?: number | undefined
  readonly registeredInCountry?: string | null | undefined
  readonly registeredIp?: string | null | undefined
  readonly lastLoginIp?: string | null | undefined
  readonly lastLoginIpIsVpn?: boolean | undefined
  readonly legacyUser?: boolean | undefined
  readonly developer?: boolean | undefined
  readonly accountLocked?: boolean | undefined
  readonly candy?: number | undefined
  readonly clearPfp?: boolean | undefined
  readonly newPassword?: string | undefined
  readonly auditReason: string
}

export async function updateUserProfileData(
  id: string,
  payload: UpdateUserProfilePayload,
): Promise<{ ok: boolean; targetPlayerId: string; updated: Record<string, any> }> {
  const res = await adminFetch(`/api/admin/users/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return handleResponse(res)
}

export async function scheduleUserDeletion(
  id: string,
  payload: { scheduledAt?: number | undefined; reason: string },
): Promise<{ ok: boolean; scheduledAt: number }> {
  const res = await adminFetch(`/api/admin/users/${encodeURIComponent(id)}/schedule-deletion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'schedule', ...payload }),
  })
  return handleResponse(res)
}

export async function cancelUserDeletion(
  id: string,
  reason: string,
): Promise<{ ok: boolean }> {
  const res = await adminFetch(`/api/admin/users/${encodeURIComponent(id)}/schedule-deletion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'cancel', reason }),
  })
  return handleResponse(res)
}

export async function deleteUserImmediate(
  id: string,
  confirmationUsername: string,
  reason: string,
): Promise<{ ok: boolean; deletedPlayerId: string; username: string }> {
  const res = await adminFetch(`/api/admin/users/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirmationUsername, reason }),
  })
  return handleResponse(res)
}

export async function fetchUserDismissables(
  id: string,
): Promise<{ ok: boolean; dismissables: Array<{ id: number; key: string; dismissedAt: number }> }> {
  const res = await adminFetch(`/api/admin/users/${encodeURIComponent(id)}/dismissables`)
  return handleResponse(res)
}

export async function resetUserDismissable(
  id: string,
  key: string,
  reason?: string | undefined,
): Promise<{ ok: boolean; resetKey: string }> {
  const res = await adminFetch(`/api/admin/users/${encodeURIComponent(id)}/dismissables`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'reset', key, reason }),
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

  const res = await adminFetch(`/api/admin/users/moderation-reports?${query.toString()}`)
  return handleResponse(res)
}

export async function resolveModerationReport(
  reportId: string,
  payload: { resolutionAction: string; details?: string | undefined },
): Promise<{ ok: boolean }> {
  const res = await adminFetch(
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
  const res = await adminFetch('/api/admin/games')
  return handleResponse(res)
}

export async function updateGameOverride(
  slug: string,
  payload: { status: string; flags: number; reason?: string | undefined },
): Promise<{ ok: boolean }> {
  const res = await adminFetch(`/api/admin/games/${encodeURIComponent(slug)}/override`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return handleResponse(res)
}

export async function fetchPlatformMetadata(): Promise<PlatformMetadataResponse> {
  const res = await adminFetch('/api/admin/platform/metadata')
  return handleResponse(res)
}

export async function updatePlatformMetadata(
  key: string,
  value: string,
  reason?: string | undefined,
): Promise<{ ok: boolean; key: string; value: string }> {
  const res = await adminFetch('/api/admin/platform/metadata', {
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

  const res = await adminFetch(`/api/admin/platform/audit-log?${query.toString()}`)
  return handleResponse(res)
}
