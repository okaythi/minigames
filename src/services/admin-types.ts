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
  readonly registeredIp?: string | null | undefined
  readonly nicknameChangedCount?: number | undefined
  readonly legacyUser?: boolean | undefined
  readonly developer?: boolean | undefined
  readonly candy?: number | undefined
  readonly scheduledDeletionAt?: number | null | undefined
  readonly scheduledDeletionReason?: string | null | undefined
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
  readonly dismissables?: Array<{
    readonly id: number
    readonly key: string
    readonly dismissedAt: number
  }> | undefined
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
  readonly targetType: string
  readonly targetId: string | null
  readonly reason: string | null
  readonly metadata: unknown
  readonly createdAt: number
}

export interface AdminUsersResponse {
  readonly ok: boolean
  readonly users: AdminUserListItem[]
  readonly total: number
  readonly metrics?: {
    readonly total: number
    readonly active: number
    readonly banned: number
  } | undefined
  readonly limit?: number | undefined
  readonly offset?: number | undefined
}
