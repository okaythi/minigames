import { useState, useEffect } from 'react'
import { Link } from '../../app/link'
import { ROUTES } from '../../app/parse-route'
import { DeveloperBadge } from './developer-badge'
import { BadgeTooltip } from './badge-tooltip'
import { hasFlag, UserFlags, FLAGS_METADATA } from '../../../shared/flags'
import type { ReleaseAuthor } from '../../engine/updates/types'
import { getPublicProfile } from '../../services/auth-api'
import './release-author-byline.css'

interface ReleaseAuthorBylineProps {
  readonly author?: ReleaseAuthor | undefined
  readonly authorUsername?: string | undefined
}

export function ReleaseAuthorByline({ author, authorUsername }: ReleaseAuthorBylineProps) {
  const [resolvedAuthor, setResolvedAuthor] = useState<ReleaseAuthor | null>(author ?? null)

  useEffect(() => {
    if (author) {
      setResolvedAuthor(author)
      return
    }

    if (!authorUsername) {
      setResolvedAuthor(null)
      return
    }

    let cancelled = false
    void getPublicProfile(authorUsername).then((profile) => {
      if (!cancelled && profile) {
        setResolvedAuthor({
          username: profile.username,
          nickname: profile.nickname ?? undefined,
          pfpUrl: profile.pfpUrl ?? null,
          flags: profile.flags,
          developer: profile.developer,
          legacyUser: profile.legacyUser,
        })
      } else if (!cancelled) {
        setResolvedAuthor({
          username: authorUsername,
        })
      }
    })

    return () => {
      cancelled = true
    }
  }, [author, authorUsername])

  const effective = resolvedAuthor ?? (authorUsername ? { username: authorUsername } : null)
  if (!effective) return null

  const flags = effective.flags ?? 0
  const isStaff = hasFlag(flags, UserFlags.STAFF)
  const isDev = hasFlag(flags, UserFlags.USER_DEVELOPER) || effective.developer === true
  const isPioneer = hasFlag(flags, UserFlags.USER_PIONEER) || effective.legacyUser === true
  const isCmsEditor = hasFlag(flags, UserFlags.CMS_EDITOR)

  return (
    <footer className="nx-release-author-byline">
      <div className="nx-author-byline-pfp">
        {effective.pfpUrl ? (
          <img src={effective.pfpUrl} alt={effective.username} />
        ) : (
          <span>{effective.username.charAt(0).toUpperCase()}</span>
        )}
      </div>

      <div className="nx-author-byline-info">
        <span className="nx-author-byline-by">by</span>
        <Link to={ROUTES.userProfile(effective.username)} className="nx-author-byline-handle">
          @{effective.username}
        </Link>

        <div className="nx-author-byline-badges">
          {isStaff && (
            <BadgeTooltip label={FLAGS_METADATA[UserFlags.STAFF]?.name ?? 'Staff'}>
              <DeveloperBadge size={16} title="" />
            </BadgeTooltip>
          )}
          {isDev && !isStaff && (
            <BadgeTooltip label={FLAGS_METADATA[UserFlags.USER_DEVELOPER]?.name ?? 'Labs Developer'}>
              <DeveloperBadge size={16} title="" />
            </BadgeTooltip>
          )}
          {isPioneer && (
            <BadgeTooltip label={FLAGS_METADATA[UserFlags.USER_PIONEER]?.name ?? 'Labs Pioneer'}>
              <span className="nx-badge-icon nx-badge-pioneer" role="img" aria-label="Labs Pioneer">
                ⚡
              </span>
            </BadgeTooltip>
          )}
          {isCmsEditor && (
            <BadgeTooltip label={FLAGS_METADATA[UserFlags.CMS_EDITOR]?.name ?? 'Update Notes Editor'}>
              <span className="nx-badge-icon nx-badge-editor" role="img" aria-label="Update Notes Editor">
                <svg viewBox="0 0 16 16" width={14} height={14} fill="currentColor" aria-hidden="true">
                  <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-9.5 9.5a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l9.5-9.5zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z" />
                </svg>
              </span>
            </BadgeTooltip>
          )}
          {effective.badges
            ?.filter((b) => b.unlocked)
            .map((b) => (
              <BadgeTooltip key={b.id ?? b.name} label={b.name}>
                <span className="nx-badge-icon nx-badge-achievement" role="img" aria-label={b.name}>
                  {b.icon}
                </span>
              </BadgeTooltip>
            ))}
        </div>
      </div>
    </footer>
  )
}
