import { useState, useEffect } from 'react'
import type { ReleaseAggregate } from '../../../engine/updates/types'
import { ArcadeTextEditor } from '../../../components/ui/rich-editor/arcade-text-editor'

interface ReleaseRationaleTabProps {
  readonly release: ReleaseAggregate
  readonly onSave: (content: string) => Promise<void>
}

export function ReleaseRationaleTab({ release, onSave }: ReleaseRationaleTabProps) {
  const [rationaleContent, setRationaleContent] = useState(release.rationale?.content || '')
  const [savingRationale, setSavingRationale] = useState(false)

  useEffect(() => {
    setRationaleContent(release.rationale?.content || '')
  }, [release.rationale])

  const handleSave = async () => {
    setSavingRationale(true)
    try {
      await onSave(rationaleContent)
    } finally {
      setSavingRationale(false)
    }
  }

  return (
    <div className="nx-tab-content">
      <p className="nx-section-desc">
        Explain the design rationale, physics intentions, and balance considerations behind this release.
      </p>
      <ArcadeTextEditor
        label="Developer Rationale (Markdown, Media & Domain Tags Supported)"
        value={rationaleContent}
        onChange={setRationaleContent}
        minHeight={220}
        placeholder="Describe design decisions, why certain mechanics changed..."
      />
      <div className="nx-form-actions" style={{ marginTop: '14px' }}>
        <button
          type="button"
          className="nx-btn nx-btn-primary"
          onClick={handleSave}
          disabled={savingRationale}
        >
          {savingRationale ? 'Saving...' : 'Save Developer Rationale'}
        </button>
      </div>
    </div>
  )
}
