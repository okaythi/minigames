import { useState, useEffect } from 'react'
import { type AdminUserDetail, updateUserFlags } from '../../../../services/admin-api'
import { isUsersAdmin, isPlatformAdmin } from '../../../../services/auth-api'
import { UserFlags, hasFlag, enableFlag, disableFlag, FLAGS_METADATA } from '../../../../../shared/flags'

interface RolesTabProps {
  readonly detail: AdminUserDetail
  readonly onRefresh: () => void
  readonly showToast: (msg: string, type?: 'ok' | 'err') => void
}

const ALL_FLAGS_LIST = [
  { bit: UserFlags.STAFF, key: 'STAFF', badge: 'STAFF' },
  { bit: UserFlags.USERS_ADMIN, key: 'USERS_ADMIN', badge: 'ADMIN' },
  { bit: UserFlags.GAMES_ADMIN, key: 'GAMES_ADMIN', badge: 'ADMIN' },
  { bit: UserFlags.PLATFORM_ADMIN, key: 'PLATFORM_ADMIN', badge: 'ADMIN' },
  { bit: UserFlags.CMS_EDITOR, key: 'CMS_EDITOR', badge: 'EDITOR' },
  { bit: UserFlags.USER_DEVELOPER, key: 'USER_DEVELOPER', badge: 'DEV' },
  { bit: UserFlags.USER_PIONEER, key: 'USER_PIONEER', badge: 'PIONEER' },
  { bit: UserFlags.USER_MESSAGES_BLOCKED, key: 'USER_MESSAGES_BLOCKED', badge: 'RESTRICTED' },
  { bit: UserFlags.USER_FRIENDS_BLOCKED, key: 'USER_FRIENDS_BLOCKED', badge: 'RESTRICTED' },
  { bit: UserFlags.USER_FRIENDS_MAX, key: 'USER_FRIENDS_MAX', badge: 'LIMIT' },
  { bit: UserFlags.TEST_ACCOUNT, key: 'TEST_ACCOUNT', badge: 'TEST' },
]

export function RolesTab({ detail, onRefresh, showToast }: RolesTabProps) {
  const { user } = detail
  const canManageFlags = isUsersAdmin() || isPlatformAdmin()
  const [currentFlags, setCurrentFlags] = useState<number>(user.flags)
  const [auditReason, setAuditReason] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setCurrentFlags(user.flags)
  }, [user.flags])

  const toggleFlag = (bit: number) => {
    if (!canManageFlags) return
    setCurrentFlags((prev) => (hasFlag(prev, bit) ? disableFlag(prev, bit) : enableFlag(prev, bit)))
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (currentFlags === user.flags) {
      showToast('No flag changes to save', 'ok')
      return
    }

    setIsSaving(true)
    const effectiveReason = auditReason.trim() || 'Updated roles & flags via Admin Console'
    try {
      await updateUserFlags(user.playerId, currentFlags, effectiveReason)
      showToast('User roles and flags updated successfully', 'ok')
      setAuditReason('')
      onRefresh()
    } catch (err: any) {
      showToast(err.message || 'Failed to update flags', 'err')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div>
        <p style={{ margin: '0 0 0.25rem', fontSize: '0.8125rem', color: 'var(--nx-slate)' }}>
          {canManageFlags
            ? 'PLATFORM_ADMIN Privilege: Toggle individual capabilities and user entitlements. Changes are audited.'
            : 'Read-only role view. PLATFORM_ADMIN capability is required to modify account flags.'}
        </p>
      </div>

      <div className="nx-admin-flag-grid">
        {ALL_FLAGS_LIST.map(({ bit, key, badge }) => {
          const isChecked = hasFlag(currentFlags, bit)
          const meta = (FLAGS_METADATA as any)[bit]
          const labelName = meta?.name || key
          const desc = meta?.description || ''

          return (
            <div
              key={key}
              className="nx-admin-flag-card"
              data-checked={isChecked ? 'true' : undefined}
              onClick={(e) => {
                if ((e.target as HTMLElement).tagName === 'INPUT') return
                toggleFlag(bit)
              }}
            >
              <input
                type="checkbox"
                checked={isChecked}
                disabled={!canManageFlags}
                onChange={() => toggleFlag(bit)}
                style={{ marginTop: '3px', cursor: canManageFlags ? 'pointer' : 'default' }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--nx-ink)' }}>
                    {labelName}
                  </span>
                  <span
                    className="nx-admin-badge"
                    data-variant={
                      badge === 'RESTRICTED' ? 'red' : badge === 'ADMIN' ? 'orange' : 'neutral'
                    }
                    style={{ fontSize: '0.65rem' }}
                  >
                    {badge}
                  </span>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--nx-slate)', lineHeight: 1.3 }}>
                  {desc}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {canManageFlags && (
        <div style={{ borderTop: '1px solid var(--nx-line)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div className="nx-admin-form-group">
            <label className="nx-admin-label">Audit Reason (Optional)</label>
            <input
              type="text"
              className="nx-admin-input"
              placeholder="e.g., Granted Update Notes Editor permission per staff review"
              value={auditReason}
              onChange={(e) => setAuditReason(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              className="nx-admin-btn nx-admin-btn-primary"
              disabled={isSaving || currentFlags === user.flags}
            >
              {isSaving ? 'Saving...' : 'Save Role & Flag Changes'}
            </button>
          </div>
        </div>
      )}
    </form>
  )
}
