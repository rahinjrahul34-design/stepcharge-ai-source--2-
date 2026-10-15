import { StrictMode, Component, type ErrorInfo, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[StepCharge AI] Uncaught render error:', error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', background: '#06080b', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', padding: '24px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#22d3ee', marginBottom: '8px' }}>StepCharge AI</h2>
          <p style={{ color: '#94a3b8', fontSize: '13px', maxWidth: '440px', textAlign: 'center', marginBottom: '16px' }}>
            {this.state.error?.message || 'Application encountered an unexpected error.'}
          </p>
          <button
            onClick={() => { localStorage.clear(); window.location.reload() }}
            style={{ padding: '8px 16px', background: 'rgba(34,211,238,0.15)', color: '#22d3ee', border: '1px solid rgba(34,211,238,0.4)', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' }}
          >
            Reset Session & Reload
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
