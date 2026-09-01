import { GameCard } from './game-card'
import type { GameManifest } from './types'
import './game-grid.css'

interface GameGridProps {
  readonly games: readonly GameManifest[]
  readonly label?: string
}

/** Three columns, three rows per page - see home-page.tsx for the paging. */
export function GameGrid({ games, label = 'Games' }: GameGridProps) {
  return (
    <ul className="nx-grid" aria-label={label}>
      {games.map((manifest) => (
        <li key={manifest.slug} className="nx-grid-item">
          <GameCard manifest={manifest} />
        </li>
      ))}
    </ul>
  )
}
