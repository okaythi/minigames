import { useState, useEffect } from 'react'
import type { ReleaseAggregate } from '../../../engine/updates/types'
import { ArcadeTextEditor } from '../../../components/ui/rich-editor/arcade-text-editor'
import { AdminChangePill } from './admin-change-pill'

interface ReleaseRationaleTabProps {
  readonly release: ReleaseAggregate
  readonly onSave: (content: string) => Promise<void>
}

export function ReleaseRationaleTab({ release, onSave }: ReleaseRationaleTabProps) {
  const initialContent = release.rationale?.content || ''
  const [rationaleContent, setRationaleContent] = useState(initialContent)
  const [savingRationale, setSavingRationale] = useState(false)

  useEffect(() => {
    setRationaleContent(release.rationale?.content || '')
  }, [release.rationale])

  const hasChanges = rationaleContent.trim() !== initialContent.trim()

  const handleDiscard = () => {
    setRationaleContent(initialContent)
  }

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

      <AdminChangePill
        hasChanges={hasChanges}
        isSaving={savingRationale}
        onSave={handleSave}
        onDiscard={handleDiscard}
        saveLabel="Save Rationale"
        discardLabel="Discard"
        message="Unsaved rationale text"
      />
    </div>
  )
}

