const games = [
  {
    name: 'Arcade',
    description: 'Fast, reactive game loops built for short sessions and quick replay.',
    accent: '88 ms',
  },
  {
    name: 'Puzzle',
    description: 'Deterministic state machines, clean win conditions, and no dead ends.',
    accent: '0 bugs',
  },
  {
    name: 'Sandbox',
    description: 'Experimental mechanics, small surfaces, and safe room for wild ideas.',
    accent: '∞ modes',
  },
] as const

const metrics = [
  { label: 'Stack', value: 'React + Vite + TypeScript' },
  { label: 'Build', value: 'Strict project references' },
  { label: 'Focus', value: 'Small games, fast iteration' },
] as const

export default function App() {
  return (
    <main className="shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Minigames</p>
          <h1>Build small web games with a sharp, strict starter.</h1>
          <p className="lede">
            This scaffold keeps the toolchain lean, the TypeScript settings unforgiving,
            and the visual language deliberate.
          </p>
        </div>

        <div className="hero-panel">
          <div className="panel-glow" aria-hidden="true" />
          <dl className="metrics">
            {metrics.map((metric) => (
              <div key={metric.label} className="metric-card">
                <dt>{metric.label}</dt>
                <dd>{metric.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="grid" aria-label="game categories">
        {games.map((game) => (
          <article key={game.name} className="game-card">
            <div className="game-card-top">
              <h2>{game.name}</h2>
              <span>{game.accent}</span>
            </div>
            <p>{game.description}</p>
          </article>
        ))}
      </section>
    </main>
  )
}