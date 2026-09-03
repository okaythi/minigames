import { useState, useRef, type ChangeEvent, type FormEvent, type DragEvent } from 'react'
import { updateNickname, updatePfp } from '../services/auth-api'
import type { UserProfileResponse } from '../../shared/auth-protocol'
import { hasFlag, UserFlags } from '../../shared/flags'
import '../pages/settings.css'

interface SettingsContentProps {
  readonly profile: UserProfileResponse
  readonly onProfileUpdated?: ((updated: UserProfileResponse) => void) | undefined
}

export function SettingsContent({ profile, onProfileUpdated }: SettingsContentProps) {
  // Avatar state
  const [stagedFile, setStagedFile] = useState<File | null>(null)
  const [stagedPreviewUrl, setStagedPreviewUrl] = useState<string | null>(null)
  const [isUploadingPfp, setIsUploadingPfp] = useState(false)
  const [pfpError, setPfpError] = useState('')
  const [pfpSuccess, setPfpSuccess] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Nickname state
  const [nicknameInput, setNicknameInput] = useState('')
  const [isUpdatingNickname, setIsUpdatingNickname] = useState(false)
  const [nicknameError, setNicknameError] = useState('')
  const [nicknameSuccess, setNicknameSuccess] = useState('')
  const [showConfirmModal, setShowConfirmModal] = useState(false)

  // Avatar handlers
  const handleFileSelect = (file: File) => {
    setPfpError('')
    setPfpSuccess('')

    if (!['image/jpeg', 'image/png', 'image/gif'].includes(file.type)) {
      setPfpError('Unsupported format. Please choose a JPEG, PNG, or GIF image.')
      return
    }

    if (file.size > 6 * 1024 * 1024) {
      setPfpError('File is too large. Maximum size is 6MB.')
      return
    }

    setStagedFile(file)
    const preview = URL.createObjectURL(file)
    setStagedPreviewUrl(preview)
  }

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleCommitPfp = async () => {
    if (!stagedFile) return
    setIsUploadingPfp(true)
    setPfpError('')
    setPfpSuccess('')

    try {
      const res = await updatePfp(stagedFile)
      const updated = { ...profile, pfpUrl: res.pfpUrl }
      setPfpSuccess('Avatar updated successfully!')
      setStagedFile(null)
      setStagedPreviewUrl(null)
      onProfileUpdated?.(updated)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error uploading profile picture.'
      setPfpError(msg)
    } finally {
      setIsUploadingPfp(false)
    }
  }

  const handleCancelPfp = () => {
    setStagedFile(null)
    if (stagedPreviewUrl) {
      URL.revokeObjectURL(stagedPreviewUrl)
      setStagedPreviewUrl(null)
    }
    setPfpError('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Nickname handlers
  const handleNicknameSubmit = (e: FormEvent) => {
    e.preventDefault()
    setNicknameError('')
    setNicknameSuccess('')

    const clean = nicknameInput.trim()
    if (clean.length < 1) {
      setNicknameError('Please enter a nickname.')
      return
    }
    if (clean.length > 30) {
      setNicknameError('Nickname must be 30 characters or fewer.')
      return
    }

    setShowConfirmModal(true)
  }

  const handleConfirmNickname = async () => {
    setShowConfirmModal(false)
    setIsUpdatingNickname(true)
    setNicknameError('')
    setNicknameSuccess('')

    const clean = nicknameInput.trim()
    try {
      await updateNickname({ nickname: clean })
      const updated: UserProfileResponse = {
        ...profile,
        nickname: clean,
        nicknameChangedCount: (profile.nicknameChangedCount ?? 0) + 1,
      }
      setNicknameSuccess('Nickname permanently updated!')
      setNicknameInput('')
      onProfileUpdated?.(updated)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error updating nickname.'
      setNicknameError(msg)
    } finally {
      setIsUpdatingNickname(false)
    }
  }

  const currentDisplayAvatar = stagedPreviewUrl || profile.pfpUrl
  const isNicknameLocked = (profile.nicknameChangedCount ?? 0) >= 1

  return (
    <div className="nx-settings-card">
      {/* 1. Avatar Section */}
      <section className="nx-settings-section">
        <div className="nx-settings-section-header">
          <h3 className="nx-settings-section-title">
            <span>🖼️</span> Profile Picture
          </h3>
          <p className="nx-settings-section-desc">
            Upload a custom avatar. Supported formats: JPEG, PNG, GIF (max 6MB).
          </p>
        </div>

        <div
          className="nx-avatar-upload-area"
          data-drag={isDragging ? 'true' : undefined}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="nx-avatar-preview-wrapper">
            {currentDisplayAvatar ? (
              <img
                src={currentDisplayAvatar}
                alt={profile.username}
                className="nx-avatar-preview-img"
              />
            ) : (
              profile.username.charAt(0).toUpperCase()
            )}
            {stagedPreviewUrl && <span className="nx-avatar-preview-badge">Preview</span>}
          </div>

          <div className="nx-avatar-upload-controls">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/png, image/jpeg, image/gif"
              style={{ display: 'none' }}
              onChange={handleFileInputChange}
            />

            <div className="nx-avatar-upload-btn-row">
              <button
                type="button"
                className="nx-file-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                <span>📁</span>
                <span>{stagedFile ? 'Choose Different File' : 'Select Image'}</span>
              </button>

              {stagedFile && (
                <>
                  <button
                    type="button"
                    className="nx-avatar-commit-btn"
                    onClick={handleCommitPfp}
                    disabled={isUploadingPfp}
                  >
                    <span>{isUploadingPfp ? 'Uploading...' : 'Save Avatar'}</span>
                  </button>
                  <button
                    type="button"
                    className="nx-avatar-cancel-btn"
                    onClick={handleCancelPfp}
                    disabled={isUploadingPfp}
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>

            {stagedFile ? (
              <div className="nx-avatar-staged-info">
                <span>📎 {stagedFile.name}</span>
                <span>•</span>
                <span>{(stagedFile.size / 1024).toFixed(1)} KB</span>
              </div>
            ) : (
              <span className="nx-avatar-meta-hint">
                Drag and drop your image here or click Select Image.
              </span>
            )}
          </div>
        </div>

        {pfpError && (
          <div className="nx-settings-alert" data-type="error">
            <span>⚠️</span> {pfpError}
          </div>
        )}
        {pfpSuccess && (
          <div className="nx-settings-alert" data-type="success">
            <span>✓</span> {pfpSuccess}
          </div>
        )}
      </section>

      <hr className="nx-settings-divider" />

      {/* 2. Nickname Section */}
      <section className="nx-settings-section">
        <div className="nx-settings-section-header">
          <h3 className="nx-settings-section-title">
            <span>🏷️</span> Display Nickname
          </h3>
          <p className="nx-settings-section-desc">
            Your public display name shown across player cards and leaderboards.
          </p>
        </div>

        {isNicknameLocked ? (
          /* When nickname is already changed (>=1), field is completely hidden */
          <div className="nx-nickname-locked-card">
            <div className="nx-nickname-locked-meta">
              <span className="nx-nickname-locked-label">Current Nickname</span>
              <span className="nx-nickname-locked-value">{profile.nickname || `@${profile.username}`}</span>
            </div>
            <span className="nx-nickname-locked-badge">
              <span>🔒</span> Permanent (Locked)
            </span>
          </div>
        ) : (
          /* When nickname has not been changed yet, show 1-time change field */
          <form onSubmit={handleNicknameSubmit} className="nx-nickname-form">
            <div className="nx-subtext-warning">
              <span>⚠️</span>
              <span>
                Nickname can only be changed once. This action is permanent and irreversible.
              </span>
            </div>

            <div className="nx-nickname-input-group">
              <div className="nx-nickname-input-wrapper">
                <input
                  type="text"
                  placeholder={profile.nickname || 'Enter permanent nickname'}
                  value={nicknameInput}
                  onChange={(e) => setNicknameInput(e.target.value)}
                  className="nx-nickname-input"
                  maxLength={30}
                  required
                />
                <span className="nx-nickname-counter">{nicknameInput.length}/30</span>
              </div>

              <button
                type="submit"
                className="nx-nickname-save-btn"
                disabled={isUpdatingNickname || nicknameInput.trim().length === 0}
              >
                {isUpdatingNickname ? 'Saving...' : 'Set Nickname'}
              </button>
            </div>
          </form>
        )}

        {nicknameError && (
          <div className="nx-settings-alert" data-type="error">
            <span>⚠️</span> {nicknameError}
          </div>
        )}
        {nicknameSuccess && (
          <div className="nx-settings-alert" data-type="success">
            <span>✓</span> {nicknameSuccess}
          </div>
        )}
      </section>

      <hr className="nx-settings-divider" />

      {/* 3. Account Details Section */}
      <section className="nx-settings-section">
        <div className="nx-settings-section-header">
          <h3 className="nx-settings-section-title">
            <span>🛡️</span> Account Identity
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <div className="nx-nickname-locked-card">
            <div className="nx-nickname-locked-meta">
              <span className="nx-nickname-locked-label">Handle</span>
              <span className="nx-nickname-locked-value">@{profile.username}</span>
            </div>
          </div>

          <div className="nx-nickname-locked-card">
            <div className="nx-nickname-locked-meta">
              <span className="nx-nickname-locked-label">Account Tier</span>
              <span className="nx-nickname-locked-value">
                {hasFlag(profile.flags, UserFlags.USER_PIONEER) || profile.legacyUser ? '⚡ Labs Pioneer' : '🎮 Arcade Member'}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Modal Confirmation Dialog */}
      {showConfirmModal && (
        <div className="nx-confirm-overlay" role="dialog" aria-modal="true">
          <div className="nx-confirm-dialog">
            <h4 className="nx-confirm-title">
              <span>⚠️</span> Confirm Permanent Nickname
            </h4>
            <p className="nx-confirm-body">
              Are you sure you want to permanently set your display nickname to{' '}
              <strong>"{nicknameInput.trim()}"</strong>?
              <br />
              <br />
              <span style={{ color: 'var(--nx-red-deep)', fontWeight: 600 }}>
                This can only be done once and cannot be undone or modified later.
              </span>
            </p>
            <div className="nx-confirm-actions">
              <button
                type="button"
                className="nx-file-btn"
                onClick={() => setShowConfirmModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="nx-avatar-commit-btn"
                style={{ background: 'var(--nx-red-deep)', borderColor: 'var(--nx-red-deep)' }}
                onClick={handleConfirmNickname}
              >
                Confirm & Lock In
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
