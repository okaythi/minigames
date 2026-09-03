import { useState, useEffect, useRef } from 'react'
import { DeveloperBadge } from './developer-badge'
import { BadgeTooltip } from './badge-tooltip'
import { hasFlag, UserFlags, FLAGS_METADATA } from '../../../shared/flags'
import type { ReleaseAuthor } from '../../engine/updates/types'
import './author-picker.css'

export interface AuthorPickerProps {
  readonly initialUsername?: string | undefined
  readonly onChange: (author: ReleaseAuthor | null, isValid: boolean) => void
  readonly label?: string
  readonly required?: boolean
}

export function AuthorPicker({
  initialUsername,
  onChange,
  label = 'Author Attribution',
  required = false,
}: AuthorPickerProps) {
  const [query, setQuery] = useState(initialUsername ?? '')
  const [selectedAuthor, setSelectedAuthor] = useState<ReleaseAuthor | null>(null)
  const [results, setResults] = useState<readonly ReleaseAuthor[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const [hasTyped, setHasTyped] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Resolve initial author on mount if an initialUsername is passed
  useEffect(() => {
    if (!initialUsername) return
    let cancelled = false

    async function resolveInitial() {
      try {
        const res = await fetch(`/api/users/${encodeURIComponent(initialUsername!)}`)
        if (res.ok) {
          const data = await res.json()
          if (!cancelled && data.profile) {
            const author: ReleaseAuthor = {
              username: data.profile.username,
              nickname: data.profile.nickname ?? undefined,
              pfpUrl: data.profile.pfpUrl ?? null,
              flags: data.profile.flags,
              developer: data.profile.developer,
              legacyUser: data.profile.legacyUser,
            }
            setSelectedAuthor(author)
            setQuery(author.username)
            onChange(author, true)
          }
        }
      } catch {
        // Fallback: search query
      }
    }

    void resolveInitial()
    return () => {
      cancelled = true
    }
  }, [initialUsername])

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Debounced auto-search
  useEffect(() => {
    if (!hasTyped || !query.trim()) {
      setResults([])
      setSearching(false)
      return
    }

    // If query matches currently selected author, no need to re-query
    if (selectedAuthor && selectedAuthor.username.toLowerCase() === query.trim().toLowerCase()) {
      return
    }

    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(query.trim())}`)
        if (res.ok) {
          const data = await res.json()
          setResults(data.users ?? [])
          setIsOpen(true)
        }
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 150)

    return () => clearTimeout(timer)
  }, [query, hasTyped, selectedAuthor])

  const handleInputChange = (val: string) => {
    setHasTyped(true)
    setQuery(val)

    if (selectedAuthor && selectedAuthor.username.toLowerCase() !== val.trim().toLowerCase()) {
      setSelectedAuthor(null)
      onChange(null, false)
    } else if (!selectedAuthor) {
      onChange(null, false)
    }
  }

  const handleSelect = (user: ReleaseAuthor) => {
    setSelectedAuthor(user)
    setQuery(user.username)
    setIsOpen(false)
    setHasTyped(false)
    onChange(user, true)
  }

  const handleClear = () => {
    setSelectedAuthor(null)
    setQuery('')
    setResults([])
    setIsOpen(false)
    setHasTyped(true)
    onChange(null, !required)
  }

  const isInvalid = hasTyped && query.trim().length > 0 && !selectedAuthor
  const isRequiredMissing = required && !selectedAuthor

  return (
    <div className="nx-author-picker-group" ref={containerRef}>
      <label className="nx-form-label">
        {label} {required && <span className="nx-required">*</span>}
      </label>

      <div className="nx-author-picker-input-wrapper">
        <input
          type="text"
          className="nx-form-input nx-author-picker-input"
          placeholder="Search author by username or nickname..."
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true)
          }}
          data-invalid={isInvalid ? 'true' : undefined}
          autoComplete="off"
        />

        {searching && <span className="nx-author-picker-spinner">⏳</span>}

        {query.length > 0 && (
          <button
            type="button"
            className="nx-author-picker-clear-btn"
            onClick={handleClear}
            title="Clear author"
          >
            ✕
          </button>
        )}
      </div>

      {/* Valid selected user chip */}
      {selectedAuthor && (
        <div className="nx-author-selected-chip">
          <div className="nx-author-chip-avatar">
            {selectedAuthor.pfpUrl ? (
              <img src={selectedAuthor.pfpUrl} alt={selectedAuthor.username} />
            ) : (
              selectedAuthor.username.charAt(0).toUpperCase()
            )}
          </div>
          <span className="nx-author-chip-name">@{selectedAuthor.username}</span>
          {selectedAuthor.nickname && (
            <span className="nx-author-chip-nickname">({selectedAuthor.nickname})</span>
          )}
          <div className="nx-author-chip-badges">
            {hasFlag(selectedAuthor.flags ?? 0, UserFlags.STAFF) && (
              <BadgeTooltip label={FLAGS_METADATA[UserFlags.STAFF]?.name ?? 'Staff'}>
                <DeveloperBadge size={14} title="" />
              </BadgeTooltip>
            )}
            {(hasFlag(selectedAuthor.flags ?? 0, UserFlags.USER_PIONEER) || selectedAuthor.legacyUser) && (
              <span className="nx-author-badge-pill pioneer">
                <span>⚡</span> Pioneer
              </span>
            )}
            {hasFlag(selectedAuthor.flags ?? 0, UserFlags.CMS_EDITOR) && (
              <span className="nx-author-badge-pill editor">Editor</span>
            )}
          </div>
          <span className="nx-author-chip-status">✓ Selected</span>
        </div>
      )}

      {/* Validation warning when text is typed but not selected from list */}
      {isInvalid && (
        <div className="nx-author-picker-warning">
          ⚠️ Non-selected user: You must select a verified user from the search dropdown.
        </div>
      )}

      {isRequiredMissing && !hasTyped && (
        <div className="nx-author-picker-hint">Please select an author for this release.</div>
      )}

      {/* Auto-search dropdown list */}
      {isOpen && results.length > 0 && (
        <ul className="nx-author-dropdown-list" role="listbox">
          {results.map((u) => {
            const isStaff = hasFlag(u.flags ?? 0, UserFlags.STAFF)
            const isPioneer = hasFlag(u.flags ?? 0, UserFlags.USER_PIONEER) || u.legacyUser
            const isCmsEditor = hasFlag(u.flags ?? 0, UserFlags.CMS_EDITOR)

            return (
              <li
                key={u.username}
                className="nx-author-dropdown-item"
                role="option"
                aria-selected={selectedAuthor?.username === u.username}
                onClick={() => handleSelect(u)}
              >
                <div className="nx-author-dropdown-avatar">
                  {u.pfpUrl ? (
                    <img src={u.pfpUrl} alt={u.username} />
                  ) : (
                    u.username.charAt(0).toUpperCase()
                  )}
                </div>

                <div className="nx-author-dropdown-meta">
                  <div className="nx-author-dropdown-top">
                    <span className="nx-author-dropdown-handle">@{u.username}</span>
                    {u.nickname && (
                      <span className="nx-author-dropdown-nick">{u.nickname}</span>
                    )}
                  </div>
                  <div className="nx-author-dropdown-badges">
                    {isStaff && (
                      <BadgeTooltip label={FLAGS_METADATA[UserFlags.STAFF]?.name ?? 'Staff'}>
                        <DeveloperBadge size={14} title="" />
                      </BadgeTooltip>
                    )}
                    {isPioneer && (
                      <span className="nx-author-badge-pill pioneer">
                        <span>⚡</span> Pioneer
                      </span>
                    )}
                    {isCmsEditor && (
                      <span className="nx-author-badge-pill editor">Editor</span>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {isOpen && !searching && results.length === 0 && hasTyped && query.trim().length > 0 && (
        <div className="nx-author-dropdown-empty">No matching users found in the database.</div>
      )}
    </div>
  )
}
