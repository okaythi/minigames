import { Link } from '../app/link'
import { ROUTES } from '../app/parse-route'
import { featuredSlug, gameCount } from '../games/registry'
import './site-footer.css'

export function SiteFooter() {
  return (
    <footer className="nx-footer">
      <div className="nx-footer-inner nx-page">
        <p className="nx-footer-note">
          <strong>Nixlabs</strong> · {gameCount} {gameCount === 1 ? 'game' : 'games'} shipped,
          each one its own folder · built with TypeScript + HTML5 canvas, hosted on Cloudflare
          Pages.
        </p>
        <nav className="nx-footer-nav" aria-label="Footer">
          <Link to={ROUTES.home}>Games</Link>
          <Link to={ROUTES.about}>About</Link>
          {featuredSlug !== null && <Link to={ROUTES.game(featuredSlug)}>Play now</Link>}
        </nav>
      </div>
    </footer>
  )
}
