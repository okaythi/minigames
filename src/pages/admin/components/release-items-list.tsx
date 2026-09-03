import { useState } from 'react'
import type { CreateItemInput, ItemId, ReleaseAggregate } from '../../../engine/updates/types'
import { ReleaseItemEditor } from './release-item-editor'

interface ReleaseItemsListProps {
  readonly release: ReleaseAggregate
  readonly onAddItem: (input: CreateItemInput) => Promise<void>
  readonly onUpdateItem: (itemId: ItemId, input: CreateItemInput) => Promise<void>
  readonly onRemoveItem: (itemId: ItemId) => Promise<void>
  readonly onReorderItems: (orderedIds: readonly ItemId[]) => Promise<void>
  readonly onFeedback: (msg: string, type?: 'ok' | 'err') => void
}

export function ReleaseItemsList({
  release,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  onReorderItems,
  onFeedback,
}: ReleaseItemsListProps) {
  const [editingItem, setEditingItem] = useState<{ id?: ItemId; index?: number } | null>(null)

  const handleMoveItem = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= release.items.length) return

    const items = [...release.items]
    const current = items[index]!
    const target = items[targetIndex]!
    items[index] = target
    items[targetIndex] = current

    await onReorderItems(items.map((i) => i.id))
    onFeedback('Item order updated!')
  }

  const handleSave = async (input: CreateItemInput) => {
    if (editingItem?.id) {
      await onUpdateItem(editingItem.id, input)
      onFeedback('Item updated!')
    } else {
      await onAddItem(input)
      onFeedback('Change item added!')
    }
    setEditingItem(null)
  }

  return (
    <div className="nx-tab-content">
      <div className="nx-items-toolbar">
        <h3 className="nx-items-header">Normalized Change Items</h3>
        <button
          type="button"
          className="nx-btn nx-btn-primary"
          onClick={() => setEditingItem({})}
        >
          + Add Change Item
        </button>
      </div>

      {editingItem !== null && (
        <div style={{ marginBottom: '20px' }}>
          <ReleaseItemEditor
            item={editingItem.id ? release.items.find((i) => i.id === editingItem.id) : undefined}
            onSave={handleSave}
            onCancel={() => setEditingItem(null)}
          />
        </div>
      )}

      {release.items.length === 0 ? (
        <p className="nx-items-empty">No change items added to this release yet.</p>
      ) : (
        <div className="nx-items-list">
          {release.items.map((item, idx) => (
            <div key={item.id} className="nx-admin-item-card">
              <div className="nx-item-order-controls">
                <button
                  type="button"
                  className="nx-order-btn"
                  disabled={idx === 0}
                  onClick={() => void handleMoveItem(idx, 'up')}
                  title="Move up"
                >
                  ▲
                </button>
                <span className="nx-order-num">{idx + 1}</span>
                <button
                  type="button"
                  className="nx-order-btn"
                  disabled={idx === release.items.length - 1}
                  onClick={() => void handleMoveItem(idx, 'down')}
                  title="Move down"
                >
                  ▼
                </button>
              </div>

              <div className="nx-item-content">
                <div className="nx-item-meta-pills">
                  <span className="nx-change-tag" data-tag={item.tag}>
                    {item.tag}
                  </span>
                  <span className="nx-scope-pill">[{item.scope.targetId}]</span>
                  {item.scope.entityName && (
                    <span className="nx-entity-pill">{item.scope.entityName}</span>
                  )}
                  {item.itemVersion && (
                    <span className="nx-version-pill">v{item.itemVersion}</span>
                  )}
                </div>
                {item.subject && <strong className="nx-item-subject">{item.subject}</strong>}
                <p className="nx-item-desc">{item.description}</p>
              </div>

              <div className="nx-item-actions">
                <button
                  type="button"
                  className="nx-btn nx-btn-sm nx-btn-secondary"
                  onClick={() => setEditingItem({ id: item.id, index: idx })}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="nx-btn nx-btn-sm nx-btn-danger"
                  onClick={() => void onRemoveItem(item.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
