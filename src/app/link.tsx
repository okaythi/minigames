import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from 'react'
import { useRouter } from './router'

interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'onClick'> {
  readonly to: string
  readonly children: ReactNode
  readonly onNavigate?: (() => void) | undefined
}

/**
 * Real anchor (so cmd/middle-click still opens a new tab) that upgrades to
 * client-side navigation on plain left clicks.
 */
export function Link({ to, children, onNavigate, ...rest }: LinkProps) {
  const { navigate } = useRouter()

  const handleClick = (event: MouseEvent<HTMLAnchorElement>): void => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      rest.target === '_blank'
    ) {
      return
    }
    event.preventDefault()
    onNavigate?.()
    navigate(to)
  }

  return (
    <a href={to} onClick={handleClick} {...rest}>
      {children}
    </a>
  )
}
