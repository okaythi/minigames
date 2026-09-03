import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useRouter } from '../../app/router'
import { ROUTES } from '../../app/parse-route'
import type { GameManifest } from '../../games/types'
import { SearchResults } from './search-results'
import { useGameSearch } from './use-game-search'
import { getAchievementBus } from '../../lib/achievement-bus'
import './search-bar.css'

interface SearchBarProps {
  readonly manifests: readonly GameManifest[]
}

/**
 * The header's centre piece: type a title, get matches. Selection is keyboard
 * first (arrows + enter), `/` focuses from anywhere, `Esc` clears.
 */
export function SearchBar({ manifests }: SearchBarProps) {
  const { navigate } = useRouter()
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const { results, trimmed } = useGameSearch(query, manifests)
  const showPanel = open && trimmed.length > 0

  const go = useCallback(
    (slug: string) => {
      setQuery('')
      setOpen(false)
      inputRef.current?.blur()
      navigate(ROUTES.game(slug))
    },
    [navigate],
  )

  useEffect(() => {
    setActiveIndex(0)
  }, [trimmed])

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

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) {
        return
      }
      const target = event.target as HTMLElement | null
      const editing =
        target !== null && (target.isContentEditable || /^(input|textarea|select)$/i.test(target.tagName))
      if (editing) {
        return
      }
      event.preventDefault()
      inputRef.current?.focus()
      setOpen(true)
      getAchievementBus().unlock('explore_terminal_velocity')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

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
        go(hit.manifest.slug)
      }
    }
  }

  const status = useMemo(() => {
    if (trimmed.length === 0) {
      return 'Type a game title to search the lab.'
    }
    const count = results.length
    return `${count} ${count === 1 ? 'match' : 'matches'}`
  }, [trimmed, results.length])

  return (
    <div className="nx-search nx-search-games" ref={rootRef} data-open={showPanel ? 'true' : 'false'}>
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
          placeholder="Search games"
          aria-label="Search game titles"
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
        {trimmed.length > 0 ? (
          <button
            type="button"
            className="nx-search-clear"
            aria-label="Clear search"
            onClick={() => {
              setQuery('')
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
        ) : (
          <kbd className="nx-search-kbd" aria-hidden="true">
            /
          </kbd>
        )}
      </div>

      <SearchResults
        listId={listId}
        showPanel={showPanel}
        results={results}
        trimmed={trimmed}
        activeIndex={activeIndex}
        status={status}
        onSelectIndex={setActiveIndex}
        onSelectGame={go}
      />
    </div>
  )
}
