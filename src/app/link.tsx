import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from 'react'
import { useRouter } from './router'

interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  readonly to: string
  readonly children: ReactNode
  readonly onNavigate?: (() => void) | undefined
  readonly onClick?: ((event: MouseEvent<HTMLAnchorElement>) => void) | undefined
}

/**
 * Real anchor (so cmd/middle-click still opens a new tab) that upgrades to
 * client-side navigation on plain left clicks.
 */
export function Link({ to, children, onNavigate, onClick, ...rest }: LinkProps) {
  const { navigate } = useRouter()

  const handleClick = (event: MouseEvent<HTMLAnchorElement>): void => {
    onClick?.(event)
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
    // Cloudflare Zero Trust (Cloudflare One) protects the /admin area at the edge.
    // Transitioning from non-admin to admin must be a full browser navigation
    // so Cloudflare One can intercept the document request and prompt for login.
    const isTargetAdmin = to === '/admin' || to.startsWith('/admin/') || to.startsWith('/admin?')
    const isCurrentAdmin =
      typeof window !== 'undefined' &&
      (window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin/'))

    if (isTargetAdmin && !isCurrentAdmin) {
      onNavigate?.()
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
