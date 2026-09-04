import { Link } from '../app/link'
import { ROUTES } from '../app/parse-route'
import { getVisibleManifests } from '../games/registry'
import { useCanSeeBetaGames } from '../services/auth-api'
import './not-found-page.css'

export function NotFoundPage({ path }: { readonly path: string }) {
  const { canSeeBetaGames } = useCanSeeBetaGames()
  const manifests = getVisibleManifests(canSeeBetaGames)

  return (
    <div className="nx-doc">
      <p className="nx-eyebrow">404 · nothing in this flask</p>
      <h1>No game lives at <code>{path}</code>.</h1>
      <p className="nx-lede">
        The lab only has {manifests.length} address{manifests.length === 1 ? '' : 'es'}. Try
        one of these, or use the search box in the menu - it matches on titles.
      </p>
      <ul className="nx-404-list">
        {manifests.map((manifest) => (
          <li key={manifest.slug}>
            <Link to={ROUTES.game(manifest.slug)}>
              <img src={manifest.cover} alt="" draggable={false} data-protected-image="true" />
              <span>
                <strong>{manifest.title}</strong>
                <em>{manifest.tagline}</em>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p>
        <Link to={ROUTES.home} className="nx-back">
          Back to all games
        </Link>
      </p>
    </div>
  )
}
