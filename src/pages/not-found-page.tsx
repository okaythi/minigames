import { Link } from '../app/link'
import { ROUTES } from '../app/parse-route'
import { MANIFESTS } from '../games/registry'
import './pages.css'

export function NotFoundPage({ path }: { readonly path: string }) {
  return (
    <div className="nx-doc">
      <p className="nx-eyebrow">404 · nothing in this flask</p>
      <h1>No game lives at <code>{path}</code>.</h1>
      <p className="nx-lede">
        The lab only has {MANIFESTS.length} address{MANIFESTS.length === 1 ? '' : 'es'}. Try
        one of these, or use the search box in the menu - it matches on titles.
      </p>
      <ul className="nx-404-list">
        {MANIFESTS.map((manifest) => (
          <li key={manifest.slug}>
            <Link to={ROUTES.game(manifest.slug)}>
              <img src={manifest.cover} alt="" />
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
