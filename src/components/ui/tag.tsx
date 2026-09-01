import type { ReactNode } from 'react'

export function Tag({ children }: { readonly children: ReactNode }) {
  return <span className="nx-tag">{children}</span>
}

export function Eyebrow({ children }: { readonly children: ReactNode }) {
  return <p className="nx-eyebrow">{children}</p>
}

export function EmptyState({ title, body }: { readonly title: string; readonly body: ReactNode }) {
  return (
    <div className="nx-empty">
      <strong>{title}</strong>
      {body}
    </div>
  )
}
