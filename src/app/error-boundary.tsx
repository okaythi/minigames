import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  readonly children: ReactNode
}

interface State {
  readonly hasError: boolean
  readonly error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary caught render error]:', error, errorInfo)
  }

  private readonly handleReset = (): void => {
    this.setState({ hasError: false, error: null })
    window.location.href = '/'
  }

  public override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div style={{ textAlign: 'center', padding: '64px 20px', maxWidth: '600px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '12px', color: 'var(--nx-graphite-deep)' }}>
            Something went wrong loading this view.
          </h2>
          <p style={{ color: 'var(--nx-muted)', marginBottom: '24px', fontSize: '0.95rem' }}>
            {this.state.error?.message ?? 'An unexpected rendering error occurred.'}
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '10px 20px',
              borderRadius: '9999px',
              background: 'var(--nx-orange, #f6821f)',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '0.875rem',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Return to Games
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
