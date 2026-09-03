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

  const flags = Number(effective.flags ?? 0)
  const isStaff = hasFlag(flags, UserFlags.STAFF)

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

        {isStaff && (
          <div className="nx-author-byline-badges">
            <BadgeTooltip label={FLAGS_METADATA[UserFlags.STAFF]?.name ?? 'Staff'}>
              <DeveloperBadge size={16} title="" />
            </BadgeTooltip>
          </div>
        )}
      </div>
    </footer>
  )
}
