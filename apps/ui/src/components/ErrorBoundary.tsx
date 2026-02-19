import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#002b36',
          color: '#839496',
          fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
          padding: '2rem',
        }}
      >
        <div style={{ maxWidth: 520, textAlign: 'center' }}>
          <div
            style={{
              fontSize: '2rem',
              fontWeight: 700,
              color: '#eee8d5',
              marginBottom: '0.75rem',
            }}
          >
            Something went wrong
          </div>
          <p style={{ lineHeight: 1.6, marginBottom: '1rem' }}>
            OpenSCAD Studio encountered an unexpected error and couldn&rsquo;t recover.
          </p>
          {this.state.error && (
            <pre
              style={{
                background: '#073642',
                color: '#cb4b16',
                padding: '0.75rem 1rem',
                borderRadius: '0.5rem',
                fontSize: '0.8125rem',
                textAlign: 'left',
                overflowX: 'auto',
                marginBottom: '1.5rem',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {this.state.error.message}
            </pre>
          )}
          <p style={{ lineHeight: 1.6, marginBottom: '2rem', fontSize: '0.875rem' }}>
            This app requires a modern browser with WebAssembly support (Chrome, Edge, or Firefox
            recommended).
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: '0.625rem 1.5rem',
              background: '#268bd2',
              color: '#002b36',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '0.9375rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
