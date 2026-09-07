import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Link } from '../../app/link'
import { ROUTES } from '../../app/parse-route'

interface GameErrorBoundaryProps {
  readonly slug: string
  readonly title: string
  readonly children: ReactNode
}

interface GameErrorBoundaryState {
  readonly hasError: boolean
  readonly error: Error | null
}

export class GameErrorBoundary extends Component<
  GameErrorBoundaryProps,
  GameErrorBoundaryState
> {
  override state: GameErrorBoundaryState = {
    hasError: false,
    error: null,
  }

  static getDerivedStateFromError(error: Error): GameErrorBoundaryState {
    return { hasError: true, error }
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(`[GameErrorBoundary] Plugin error in ${this.props.slug}:`, error, errorInfo)
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          className="nx-game-error-fallback"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '380px',
            padding: '32px 24px',
            margin: '0 auto',
            maxWidth: '480px',
            textAlign: 'center',
            background: 'var(--nx-card, #fffdf9)',
            border: '1px solid var(--nx-line, #e6e0d6)',
            borderRadius: 'var(--nx-radius, 8px)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.06)',
          }}
        >
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>⚠️</div>
          <h3
            style={{
              margin: '0 0 8px',
              fontSize: '18px',
              fontWeight: 800,
              color: 'var(--nx-ink, #232324)',
            }}
          >
            Engine Error
          </h3>
          <p
            style={{
              margin: '0 0 20px',
              fontSize: '13.5px',
              color: 'var(--nx-slate, #6e6e73)',
              lineHeight: 1.5,
            }}
          >
            <strong>{this.props.title}</strong> could not run due to an engine exception.
            The rest of the platform remains unaffected.
          </p>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={this.handleRetry}
              style={{
                padding: '8px 18px',
                background: 'var(--nx-orange, #f6821f)',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Restart Engine
            </button>
            <Link
              to={ROUTES.home}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '8px 18px',
                background: 'rgba(0, 0, 0, 0.05)',
                color: 'var(--nx-ink, #232324)',
                borderRadius: '6px',
                fontWeight: 600,
                fontSize: '13px',
                textDecoration: 'none',
              }}
            >
              Return to Arcade
            </Link>
          </div>

          {this.state.error && (
            <details
              style={{
                marginTop: '20px',
                textAlign: 'left',
                width: '100%',
                fontSize: '11px',
                color: 'var(--nx-slate, #6e6e73)',
                fontFamily: 'var(--nx-font-mono, monospace)',
                background: 'rgba(0, 0, 0, 0.03)',
                padding: '8px 12px',
                borderRadius: '4px',
                overflowX: 'auto',
              }}
            >
              <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Error details</summary>
              <pre style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap' }}>
                {this.state.error.message}
              </pre>
            </details>
          )}
        </div>
      )
    }

    return this.props.children
  }
}
