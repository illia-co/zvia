import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@renderer/components/ui/button'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[Relay] Uncaught render error:', error, info.componentStack)
  }

  handleReload = (): void => {
    window.location.reload()
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="flex h-full items-center justify-center bg-bg p-8">
          <div className="max-w-md rounded-panel border border-divider bg-bg-secondary p-6">
            <h1 className="text-sm font-medium text-text">Something went wrong</h1>
            <p className="mt-2 text-xs text-text-secondary">
              {this.state.error.message || 'An unexpected error occurred.'}
            </p>
            <div className="mt-4">
              <Button size="sm" onClick={this.handleReload}>
                Reload
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
