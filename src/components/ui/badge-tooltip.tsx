import { useState, useCallback, type ReactNode } from 'react'
import './badge-tooltip.css'

interface BadgeTooltipProps {
  /** The name shown inside the floating tooltip. */
  readonly label: string
  readonly children: ReactNode
}

/**
 * Wraps a badge icon. On hover, renders a small pill that tracks the cursor.
 * Only intended for badge icons next to the user handle — not pills/tags.
 */
export function BadgeTooltip({ label, children }: BadgeTooltipProps) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)

  const onMove = useCallback((e: React.MouseEvent) => {
    setPos({ x: e.clientX, y: e.clientY })
  }, [])

  const onLeave = useCallback(() => {
    setPos(null)
  }, [])

  return (
    <span
      className="nx-badge-tooltip-host"
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      {children}
      {pos !== null && (
        <span
          className="nx-badge-tooltip-bubble"
          style={{
            left: pos.x,
            top: pos.y,
          }}
        >
          {label}
        </span>
      )}
    </span>
  )
}
