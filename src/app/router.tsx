import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { normalizePathname, parseRoute } from './parse-route'
import type { Route } from './route-types'

/**
 * A ~90 line router. Static hosts (Cloudflare Pages) serve every path through
 * `public/_redirects`, so plain history.pushState is all we need.
 */

interface RouterValue {
  readonly route: Route
  readonly navigate: (to: string, options?: { readonly replace?: boolean }) => void
}

const RouterContext = createContext<RouterValue | null>(null)

const currentLocation = (): { pathname: string; search: string } => ({
  pathname: window.location.pathname,
  search: window.location.search,
})

export function RouterProvider({ children }: { readonly children: ReactNode }) {
  const [location, setLocation] = useState(currentLocation)

  useEffect(() => {
    const handlePopState = (): void => {
      setLocation(currentLocation())
    }
    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  const navigate = useCallback((to: string, options?: { readonly replace?: boolean }) => {
    const url = new URL(to, window.location.origin)
    if (
      normalizePathname(url.pathname) === normalizePathname(window.location.pathname) &&
      url.search === window.location.search
    ) {
      return
    }
    if (options?.replace === true) {
      window.history.replaceState({}, '', url.pathname + url.search)
    } else {
      window.history.pushState({}, '', url.pathname + url.search)
    }
    setLocation({ pathname: url.pathname, search: url.search })
  }, [])

  const value = useMemo<RouterValue>(
    () => ({ route: parseRoute(location.pathname, location.search), navigate }),
    [location, navigate],
  )

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>
}

export function useRouter(): RouterValue {
  const value = useContext(RouterContext)
  if (value === null) {
    throw new Error('useRouter must be used inside <RouterProvider>')
  }
  return value
}

export function useRoute(): Route {
  return useRouter().route
}
