import { useState, useEffect } from 'react'
import { type AdminUserDetail, updateUserProfileData } from '../../../../services/admin-api'

interface ProfileTabProps {
  readonly detail: AdminUserDetail
  readonly onRefresh: () => void
  readonly showToast: (msg: string, type?: 'ok' | 'err') => void
}

export function ProfileTab({ detail, onRefresh, showToast }: ProfileTabProps) {
  const { user } = detail
  const [username, setUsername] = useState(user.username)
  const [nickname, setNickname] = useState(user.nickname || '')
  const [nicknameCount, setNicknameCount] = useState<number>(user.nicknameChangedCount ?? 0)
  const [country, setCountry] = useState(user.registeredInCountry || '')
  const [regIp, setRegIp] = useState(user.registeredIp || '')
  const [lastIp, setLastIp] = useState(user.lastLoginIp || '')
  const [isVpn, setIsVpn] = useState(user.lastLoginIpIsVpn)
  const [isPioneer, setIsPioneer] = useState(user.legacyUser ?? false)
  const [isDeveloper, setIsDeveloper] = useState(user.developer ?? false)
  const [candy, setCandy] = useState<number>(user.candy ?? 0)
  const [newPassword, setNewPassword] = useState('')
  const [clearPfp, setClearPfp] = useState(false)
  const [auditReason, setAuditReason] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setUsername(user.username)
    setNickname(user.nickname || '')
    setNicknameCount(user.nicknameChangedCount ?? 0)
    setCountry(user.registeredInCountry || '')
    setRegIp(user.registeredIp || '')
    setLastIp(user.lastLoginIp || '')
    setIsVpn(user.lastLoginIpIsVpn)
    setIsPioneer(user.legacyUser ?? false)
    setIsDeveloper(user.developer ?? false)
    setCandy(user.candy ?? 0)
  }, [user])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    const effectiveReason = auditReason.trim() || 'Administrative profile update via Admin Console'
    try {
      await updateUserProfileData(user.playerId, {
        username: username.trim() !== user.username ? username.trim() : undefined,
        nickname: nickname.trim() || null,
        nicknameChangedCount: nicknameCount,
        registeredInCountry: country.trim() || null,
        registeredIp: regIp.trim() || null,
        lastLoginIp: lastIp.trim() || null,
        lastLoginIpIsVpn: isVpn,
        legacyUser: isPioneer,
        developer: isDeveloper,
        candy: candy >= 0 ? candy : undefined,
        clearPfp: clearPfp || undefined,
        newPassword: newPassword.trim().length >= 6 ? newPassword.trim() : undefined,
        auditReason: effectiveReason,
      })
      showToast('User record updated successfully', 'ok')
      setAuditReason('')
      setNewPassword('')
      setClearPfp(false)
      onRefresh()
    } catch (err: any) {
      showToast(err.message || 'Failed to update user', 'err')
    } finally {
      setIsSaving(false)
    }
  }

  const handleResetNicknameLimit = () => {
    setNicknameCount(0)
    showToast('Nickname limit reset staged to 0 (Save to apply)', 'ok')
  }

  return (
    <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="nx-admin-form-row">
        <div className="nx-admin-form-group">
          <label className="nx-admin-label">Username</label>
          <input
            type="text"
            className="nx-admin-input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div className="nx-admin-form-group">
          <label className="nx-admin-label">Nickname (Display Name)</label>
          <input
            type="text"
            className="nx-admin-input"
            placeholder="No nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
          />
        </div>
      </div>

      <div className="nx-admin-form-row">
        <div className="nx-admin-form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="nx-admin-label">Nickname Change Count</label>
            <button
              type="button"
              className="nx-admin-btn nx-admin-btn-secondary nx-admin-btn-sm"
              onClick={handleResetNicknameLimit}
            >
              Reset to 0 (Allow Change)
            </button>
          </div>
          <input
            type="number"
            className="nx-admin-input"
            value={nicknameCount}
            onChange={(e) => setNicknameCount(Number(e.target.value))}
          />
          <span className="nx-admin-hint">Standard accounts are capped at 1 nickname change.</span>
        </div>
        <div className="nx-admin-form-group">
          <label className="nx-admin-label">Candy Balance</label>
          <input
            type="number"
            className="nx-admin-input"
            value={candy}
            onChange={(e) => setCandy(Number(e.target.value))}
          />
        </div>
      </div>

      <div className="nx-admin-form-row">
        <div className="nx-admin-form-group">
          <label className="nx-admin-label">Set New Password</label>
          <input
            type="password"
            className="nx-admin-input"
            placeholder="Leave blank to keep unchanged"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>
        <div className="nx-admin-form-group">
          <label className="nx-admin-label">Avatar Management</label>
          {user.pfpUrl ? (
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '6px' }}>
              <input
                type="checkbox"
                checked={clearPfp}
                onChange={(e) => setClearPfp(e.target.checked)}
              />
              <span style={{ fontSize: '0.8125rem' }}>Clear / Remove Profile Picture</span>
            </label>
          ) : (
            <span className="nx-admin-hint" style={{ marginTop: '8px' }}>User has no custom avatar.</span>
          )}
        </div>
      </div>

      <div className="nx-admin-form-row">
        <div className="nx-admin-form-group">
          <label className="nx-admin-label">Country Code</label>
          <input
            type="text"
            className="nx-admin-input"
            placeholder="e.g. US, DE, FR"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          />
        </div>
        <div className="nx-admin-form-group">
          <label className="nx-admin-label">Registration IP</label>
          <input
            type="text"
            className="nx-admin-input nx-admin-mono"
            value={regIp}
            onChange={(e) => setRegIp(e.target.value)}
          />
        </div>
        <div className="nx-admin-form-group">
          <label className="nx-admin-label">Last Login IP</label>
          <input
            type="text"
            className="nx-admin-input nx-admin-mono"
            value={lastIp}
            onChange={(e) => setLastIp(e.target.value)}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', padding: '0.5rem 0' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={isVpn} onChange={(e) => setIsVpn(e.target.checked)} />
          <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>VPN / Datacenter IP</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={isPioneer} onChange={(e) => setIsPioneer(e.target.checked)} />
          <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Labs Pioneer Entitlement</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={isDeveloper} onChange={(e) => setIsDeveloper(e.target.checked)} />
          <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Developer Entitlement</span>
        </label>
      </div>

      <div className="nx-admin-form-group" style={{ borderTop: '1px solid var(--nx-line)', paddingTop: '1rem' }}>
        <label className="nx-admin-label">Audit Reason (Optional)</label>
        <input
          type="text"
          className="nx-admin-input"
          placeholder="e.g., Staff reset nickname change limit; updated country code"
          value={auditReason}
          onChange={(e) => setAuditReason(e.target.value)}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
        <button type="submit" className="nx-admin-btn nx-admin-btn-primary" disabled={isSaving}>
          {isSaving ? 'Saving Changes...' : 'Save Profile Updates'}
        </button>
      </div>
    </form>
  )
}
