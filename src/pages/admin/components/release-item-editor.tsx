import { useState, type FormEvent } from 'react'
import type { CreateItemInput, ReleaseItem, TargetScopeType, UpdateTag } from '../../../engine/updates/types'
import { ArcadeTextEditor } from '../../../components/ui/rich-editor/arcade-text-editor'

interface ReleaseItemEditorProps {
  readonly item?: ReleaseItem | undefined
  readonly onSave: (input: CreateItemInput) => Promise<void>
  readonly onCancel: () => void
}

const KNOWN_TARGETS = [
  { id: 'avoid-the-spikes', label: 'Avoid the Spikes!' },
  { id: 'fl-tron-3', label: 'FL Tron 3.0' },
  { id: 'pong', label: 'Pong' },
  { id: 'platform', label: 'Arcade Platform' },
]

export function ReleaseItemEditor({ item, onSave, onCancel }: ReleaseItemEditorProps) {
  const [scopeType, setScopeType] = useState<TargetScopeType>(item?.scope.type ?? 'game')
  const [targetId, setTargetId] = useState(item?.scope.targetId ?? 'avoid-the-spikes')
  const [entityName, setEntityName] = useState(item?.scope.entityName ?? '')
  const [tag, setTag] = useState<UpdateTag>(item?.tag ?? 'Balance')
  const [itemVersion, setItemVersion] = useState(item?.itemVersion ?? '')
  const [subject, setSubject] = useState(item?.subject ?? '')
  const [description, setDescription] = useState(item?.description ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!description.trim()) {
      setError('Description cannot be empty.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      await onSave({
        scope: {
          type: scopeType,
          targetId: targetId.trim(),
          entityName: entityName.trim() || undefined,
        },
        tag,
        itemVersion: itemVersion.trim() || undefined,
        subject: subject.trim() || undefined,
        description: description.trim(),
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save item')
      setSaving(false)
    }
  }

  return (
    <form className="nx-item-editor-card" onSubmit={handleSubmit}>
      <h3 className="nx-item-editor-title">{item ? 'Edit Change Item' : 'Add New Change Item'}</h3>

      <div className="nx-admin-form-grid">
        <div className="nx-form-group">
          <label className="nx-form-label" htmlFor="nx-item-scope-type">
            Scope Type <span className="nx-required">*</span>
          </label>
          <select
            id="nx-item-scope-type"
            className="nx-form-select"
            value={scopeType}
            onChange={(e) => setScopeType(e.target.value as TargetScopeType)}
          >
            <option value="game">Game Specific</option>
            <option value="engine">Engine / Physics</option>
            <option value="platform">Arcade Platform</option>
          </select>
        </div>

        <div className="nx-form-group">
          <label className="nx-form-label" htmlFor="nx-item-target-id">
            Target Component <span className="nx-required">*</span>
          </label>
          <select
            id="nx-item-target-id"
            className="nx-form-select"
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
          >
            {KNOWN_TARGETS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label} ({t.id})
              </option>
            ))}
          </select>
        </div>

        <div className="nx-form-group">
          <label className="nx-form-label" htmlFor="nx-item-entity-name">
            Subsystem / Entity Name
          </label>
          <input
            id="nx-item-entity-name"
            className="nx-form-input"
            type="text"
            placeholder="e.g. Red Movers, Voronoi AI, Paddle"
            value={entityName}
            onChange={(e) => setEntityName(e.target.value)}
          />
        </div>

        <div className="nx-form-group">
          <label className="nx-form-label" htmlFor="nx-item-tag">
            Category Tag <span className="nx-required">*</span>
          </label>
          <select
            id="nx-item-tag"
            className="nx-form-select"
            value={tag}
            onChange={(e) => setTag(e.target.value as UpdateTag)}
          >
            <option value="Balance">Balance</option>
            <option value="New">New</option>
            <option value="Fix">Fix</option>
            <option value="Feature">Feature</option>
            <option value="Polish">Polish</option>
          </select>
        </div>

        <div className="nx-form-group">
          <label className="nx-form-label" htmlFor="nx-item-version">
            Item Version (Granular)
          </label>
          <input
            id="nx-item-version"
            className="nx-form-input"
            type="text"
            placeholder="e.g. 1.2.0, 2.1.0"
            value={itemVersion}
            onChange={(e) => setItemVersion(e.target.value)}
          />
        </div>

        <div className="nx-form-group">
          <label className="nx-form-label" htmlFor="nx-item-subject">
            Subject Summary
          </label>
          <input
            id="nx-item-subject"
            className="nx-form-input"
            type="text"
            placeholder="e.g. Despawn Buffer, Zero-Trap Veto"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>
      </div>

      <div className="nx-form-group nx-full-width" style={{ marginTop: '8px' }}>
        <ArcadeTextEditor
          label="Detailed Description (Markdown Supported)"
          value={description}
          onChange={setDescription}
          placeholder="Describe the balance change, mechanic tuning, or feature details..."
          minHeight={140}
        />
      </div>

      {error && <div className="nx-form-error">⚠️ {error}</div>}

      <div className="nx-form-actions" style={{ marginTop: '12px' }}>
        <button type="button" className="nx-btn nx-btn-secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className="nx-btn nx-btn-primary" disabled={saving}>
          {saving ? 'Saving Item...' : item ? 'Update Item' : 'Add Item'}
        </button>
      </div>
    </form>
  )
}
