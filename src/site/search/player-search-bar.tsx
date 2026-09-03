import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useRouter } from '../../app/router'
import { ROUTES } from '../../app/parse-route'
import './search-bar.css'
import './player-search-bar.css'

interface UserMatch {
  readonly username: string
  readonly pfpUrl: string | null
}

export function PlayerSearchBar() {
  const { navigate } = useRouter()
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<readonly UserMatch[]>([])
  const [activeIndex, setActiveIndex] = useState(0)

  const trimmed = query.trim().replace(/^@/, '')
  const showPanel = open && trimmed.length > 0

  const go = useCallback(
    (username: string) => {
      setQuery('')
      setOpen(false)
      inputRef.current?.blur()
      navigate(ROUTES.userProfile(username))
    },
    [navigate],
  )

  useEffect(() => {
    setActiveIndex(0)
  }, [results])

  // Live typing-finding with debounce and cancellation
  useEffect(() => {
    if (!trimmed) {
      setResults([])
      setLoading(false)
      return
    }

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        })
        if (res.ok) {
          const data = await res.json()
          if (!controller.signal.aborted) {
            setResults(data.users ?? [])
          }
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return
        }
        if (!controller.signal.aborted) {
          setResults([])
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }, 120)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [trimmed])

  // Close panel when clicking outside
  useEffect(() => {
    if (!showPanel) {
      return
    }
    const onPointerDown = (event: PointerEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [showPanel])

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Escape') {
      if (trimmed.length > 0) {
        setQuery('')
      }
      setOpen(false)
      inputRef.current?.blur()
      return
    }

    if (!showPanel || results.length === 0) {
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) => (index + 1) % results.length)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => (index - 1 + results.length) % results.length)
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      const hit = results[activeIndex] ?? results[0]
      if (hit !== undefined) {
        go(hit.username)
      }
    }
  }

  return (
    <div
      className="nx-search nx-search-players"
      ref={rootRef}
      data-open={showPanel ? 'true' : 'false'}
    >
      <div className="nx-search-field">
        <svg className="nx-search-icon" viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="9" cy="9" r="5.4" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path d="m13.2 13.2 3.3 3.3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          className="nx-search-input"
          placeholder="Search players"
          aria-label="Search players"
          title="Search players"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
        />
        {trimmed.length > 0 && (
          <button
            type="button"
            className="nx-search-clear"
            aria-label="Clear player search"
            onClick={() => {
              setQuery('')
              setResults([])
              inputRef.current?.focus()
            }}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path
                d="m4.4 4.4 7.2 7.2M11.6 4.4l-7.2 7.2"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
      </div>

      <div
        className="nx-search-panel"
        id={listId}
        role="listbox"
        aria-label="Player matches"
        data-empty={showPanel && results.length === 0 ? 'true' : undefined}
      >
        {showPanel &&
          (loading && results.length === 0 ? (
            <p className="nx-search-none">Searching players...</p>
          ) : results.length === 0 ? (
            <p className="nx-search-none">
              No players found matching <strong>“{trimmed}”</strong>.
            </p>
          ) : (
            <ul className="nx-search-list nx-player-search-list">
              {results.map((user, index) => (
                <li key={user.username}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    className="nx-player-search-item"
                    data-active={index === activeIndex ? 'true' : undefined}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => go(user.username)}
                  >
                    <div className="nx-player-search-avatar">
                      {user.pfpUrl ? (
                        <img src={user.pfpUrl} alt="" draggable={false} />
                      ) : (
                        <span>{user.username.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <span className="nx-player-search-username">@{user.username}</span>
                  </button>
                </li>
              ))}
            </ul>
          ))}
      </div>
    </div>
  )
}
