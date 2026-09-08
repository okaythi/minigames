import { useState, useEffect } from 'react'
import { isPlatformAdmin, subscribeAuth } from '../../services/auth-api'
import {
  fetchPlatformMetadata,
  updatePlatformMetadata,
  fetchAuditLog,
  type AuditLogItem,
} from '../../services/admin-api'
import { AdminNavBar } from './components/admin-nav-bar'
import { AdminRestrictedCard } from './components/admin-restricted-card'
import { PlatformMetadataTable } from './components/platform-metadata-table'
import { AuditLogTable } from './components/audit-log-table'
import { FeedbackToast, type ToastMessage } from '../../components/ui/feedback-toast'
import './admin-common.css'

export function AdminPlatformPage() {
  const [authorized, setAuthorized] = useState<boolean>(isPlatformAdmin())
  const [activeTab, setActiveTab] = useState<'metadata' | 'audit'>('metadata')

  // Metadata state
  const [metadata, setMetadata] = useState<Record<string, { value: string | null; updatedBy: string | null; updatedAt: number }>>({})
  const [systemConfig, setSystemConfig] = useState<Record<string, number>>({})
  const [loadingMeta, setLoadingMeta] = useState(false)

  // Audit log state
  const [auditEntries, setAuditEntries] = useState<AuditLogItem[]>([])
  const [auditTotal, setAuditTotal] = useState(0)
  const [filterTargetType, setFilterTargetType] = useState<string>('')
  const [filterAction, setFilterAction] = useState<string>('')
  const [loadingAudit, setLoadingAudit] = useState(false)

  // Native toast feedback
  const [toast, setToast] = useState<ToastMessage | null>(null)

  useEffect(() => {
    setAuthorized(isPlatformAdmin())
    return subscribeAuth(() => {
      setAuthorized(isPlatformAdmin())
    })
  }, [])

  const showToast = (message: string, type: 'ok' | 'err' | 'info' = 'ok') => {
    setToast({ id: String(Date.now()), message, type })
  }

  const loadMetadata = async () => {
    setLoadingMeta(true)
    try {
      const res = await fetchPlatformMetadata()
      setMetadata(res.metadata)
      setSystemConfig(res.systemConfig)
    } catch (err: any) {
      showToast(err.message || 'Failed to load platform metadata', 'err')
    } finally {
      setLoadingMeta(false)
    }
  }

  const loadAudit = async () => {
    setLoadingAudit(true)
    try {
      const res = await fetchAuditLog({
        targetType: filterTargetType || undefined,
        action: filterAction || undefined,
        limit: 50,
      })
      setAuditEntries(res.entries)
      setAuditTotal(res.total)
    } catch (err: any) {
      showToast(err.message || 'Failed to load audit log', 'err')
    } finally {
      setLoadingAudit(false)
    }
  }

  useEffect(() => {
    if (!authorized) return
    if (activeTab === 'metadata') {
      void loadMetadata()
    } else {
      void loadAudit()
    }
  }, [authorized, activeTab, filterTargetType, filterAction])

  const handleSaveMetadata = async (key: string, value: string, reason?: string) => {
    try {
      await updatePlatformMetadata(key, value, reason)
      showToast(`Platform key '${key}' updated successfully`, 'ok')
      void loadMetadata()
    } catch (err: any) {
      showToast(err.message || 'Failed to update metadata', 'err')
    }
  }

  if (!authorized) {
    return (
      <AdminRestrictedCard
        title="Platform Administration Access Required"
        requiredFlags="PLATFORM_ADMIN"
        panelName="Platform Metadata & Audit Explorer"
      />
    )
  }

  return (
    <div className="nx-page nx-admin-layout">
      <div className="nx-admin-header">
        <div className="nx-admin-header-title">
          <h1>Platform Administration</h1>
          <p>Configure text metadata, inspect immutable system audit logs, and administer global parameters.</p>
        </div>
        <AdminNavBar activeTab="platform" />
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--nx-line)', paddingBottom: '0.5rem' }}>
        <button
          type="button"
          className={`nx-admin-nav-tab ${activeTab === 'metadata' ? 'active' : ''}`}
          onClick={() => setActiveTab('metadata')}
        >
          Platform Metadata ({Object.keys(metadata).length})
        </button>
        <button
          type="button"
          className={`nx-admin-nav-tab ${activeTab === 'audit' ? 'active' : ''}`}
          onClick={() => setActiveTab('audit')}
        >
          Audit Log ({auditTotal})
        </button>
      </div>

      {activeTab === 'metadata' ? (
        <PlatformMetadataTable
          metadata={metadata}
          systemConfig={systemConfig}
          loading={loadingMeta}
          onRefresh={loadMetadata}
          onSaveMetadata={handleSaveMetadata}
        />
      ) : (
        <AuditLogTable
          entries={auditEntries}
          total={auditTotal}
          loading={loadingAudit}
          filterTargetType={filterTargetType}
          filterAction={filterAction}
          onTargetTypeChange={setFilterTargetType}
          onActionChange={setFilterAction}
          onFilterSubmit={loadAudit}
        />
      )}

      <FeedbackToast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}
