import { useState } from 'react'
import { claimSyncCode } from '../services/stats/stats-api'
import { Button } from '../components/ui/button'

export function SyncModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  return (
    <div className="nx-modal-backdrop" role="dialog" aria-modal="true">
      <div className="nx-modal">
        <h3>Enter Sync Code</h3>
        <p>Type the code shown on your other device to load your data.</p>
        <input
          aria-label="sync code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="K9F2-P7X1"
        />
        <div style={{ marginTop: 12 }}>
          <Button onClick={onClose} variant="ghost">Cancel</Button>
          <Button
            onClick={async () => {
              setError(null)
              setLoading(true)
              const result = await claimSyncCode(code)
              setLoading(false)
              if (result === null) {
                setError('Invalid code or network error')
                return
              }
              // A cookie was set by the server; reload to pick up player row.
              window.location.reload()
            }}
            variant="primary"
            style={{ marginLeft: 8 }}
            disabled={loading}
          >
            {loading ? 'Applying…' : 'Apply Code'}
          </Button>
        </div>
        {error && <div style={{ color: 'var(--nx-color-danger)', marginTop: 8 }}>{error}</div>}
      </div>
    </div>
  )
}
