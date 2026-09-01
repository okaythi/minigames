import { useState, useEffect, useRef } from 'react'
import { claimSyncCode } from '../services/stats/stats-api'
import { Button } from '../components/ui/button'
import './sync-modal.css'
import { parseSyncCode } from '../../shared/player-cookie'

export function SyncModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const handleClickOutside = (e: MouseEvent) => {
      // Allow clicking on the sync button itself
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        const target = e.target as HTMLElement
        if (!target.closest('#nx-sync-container')) {
          onClose()
        }
      }
    }

    document.addEventListener('keydown', handleEscape)
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="nx-sync-menu" ref={menuRef} role="dialog" aria-label="Sync Menu">
      <h3>Enter Sync Code</h3>
      <p>Type the code shown on your other device to load your data.</p>
      <input
        className="nx-sync-input"
        aria-label="sync code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="XXXX-XXXX"
      />
      <div className="nx-sync-actions">
        <Button onClick={onClose} variant="ghost" size="small">Cancel</Button>
        <Button
          onClick={async () => {
            setError(null)
            const normalized = parseSyncCode(code)
            if (normalized === null) {
              setError('Code must be in the form XXXX-XXXX')
              return
            }
            setLoading(true)
            const result = await claimSyncCode(normalized)
            setLoading(false)
            if (result === null) {
              setError('Invalid code or network error')
              return
            }
            window.location.reload()
          }}
          variant="primary"
          size="small"
          disabled={loading}
        >
          {loading ? 'Applying…' : 'Apply'}
        </Button>
      </div>
      {error && <div className="nx-sync-error">{error}</div>}
    </div>
  )
}
