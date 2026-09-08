import { useEffect } from 'react'

export interface ToastMessage {
  readonly id: string
  readonly message: string
  readonly type?: 'ok' | 'err' | 'info' | undefined
}

interface FeedbackToastProps {
  readonly toast: ToastMessage | null
  readonly onDismiss: () => void
}

export function FeedbackToast({ toast, onDismiss }: FeedbackToastProps) {
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => {
      onDismiss()
    }, 4000)
    return () => clearTimeout(timer)
  }, [toast, onDismiss])

  if (!toast) return null

  const isErr = toast.type === 'err'
  const isOk = toast.type === 'ok'

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 9999,
        background: isErr ? '#321414' : isOk ? '#12261b' : 'var(--nx-ink)',
        color: '#ffffff',
        padding: '0.75rem 1.25rem',
        borderRadius: '8px',
        border: `1px solid ${isErr ? 'var(--nx-red)' : isOk ? 'var(--nx-green)' : 'var(--nx-slate)'}`,
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        fontSize: '0.875rem',
        maxWidth: '420px',
        animation: 'nxToastIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <span style={{ fontSize: '1rem' }}>
        {isErr ? '⚠️' : isOk ? '✓' : 'ℹ'}
      </span>
      <div style={{ flex: 1, lineHeight: 1.4 }}>{toast.message}</div>
      <button
        type="button"
        onClick={onDismiss}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'rgba(255, 255, 255, 0.7)',
          cursor: 'pointer',
          padding: '2px 6px',
          fontSize: '0.875rem',
        }}
      >
        ✕
      </button>
    </div>
  )
}
