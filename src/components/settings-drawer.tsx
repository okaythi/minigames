import { useEffect } from 'react'
import type { UserProfileResponse } from '../../shared/auth-protocol'
import { SettingsContent } from './settings-content'
import './settings-drawer.css'

interface SettingsDrawerProps {
  readonly isOpen: boolean
  readonly profile: UserProfileResponse | null
  readonly onClose: () => void
  readonly onProfileUpdated?: ((updated: UserProfileResponse) => void) | undefined
}

export function SettingsDrawer({ isOpen, profile, onClose, onProfileUpdated }: SettingsDrawerProps) {
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen || !profile) return null

  return (
    <>
      <div className="nx-drawer-backdrop" onClick={onClose} />
      <div className="nx-drawer-panel" role="dialog" aria-modal="true">
        <header className="nx-drawer-header">
          <div className="nx-drawer-title-group">
            <h2 className="nx-drawer-title">Profile Settings</h2>
            <p className="nx-drawer-subtitle">Manage avatar and display name</p>
          </div>
          <button
            type="button"
            className="nx-drawer-close-btn"
            onClick={onClose}
            aria-label="Close settings drawer"
          >
            ✕
          </button>
        </header>

        <div className="nx-drawer-body">
          <SettingsContent profile={profile} onProfileUpdated={onProfileUpdated} />
        </div>
      </div>
    </>
  )
}
