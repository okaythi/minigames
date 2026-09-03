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
              <span className="nx-author-badge-pill pioneer">
                <span>⚡</span> Pioneer
              </span>
            </BadgeTooltip>
          )}
          {isCmsEditor && (
            <BadgeTooltip label={FLAGS_METADATA[UserFlags.CMS_EDITOR]?.name ?? 'Update Notes Editor'}>
              <span className="nx-author-badge-pill editor">Editor</span>
            </BadgeTooltip>
          )}
        </div>
      </div>
    </footer>
  )
}
