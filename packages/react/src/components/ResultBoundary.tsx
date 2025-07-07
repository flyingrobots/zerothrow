import { Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import { ZT } from '@zerothrow/core'
import type { Result } from '@zerothrow/core'

export interface ResultBoundaryProps {
  /**
   * Fallback component to render when an error is caught
   */
  fallback: (result: Result<never, Error>, reset: () => void) => ReactNode
  
  /**
   * Optional error handler for logging/telemetry
   */
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  
  /**
   * Children to render when no error
   */
  children: ReactNode
}

interface ResultBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * Error boundary that converts thrown errors to Result types.
 * 
 * Unlike standard error boundaries, this provides the error as a Result
 * to the fallback component, enabling type-safe error handling.
 * 
 * @example
 * ```tsx
 * <ResultBoundary
 *   fallback={(result, reset) => (
 *     <ErrorFallback
 *       error={result.error}
 *       onRetry={reset}
 *     />
 *   )}
 *   onError={(error, info) => {
 *     console.error('Boundary caught:', error)
 *     sendToTelemetry(error, info)
 *   }}
 * >
 *   <App />
 * </ResultBoundary>
 * ```
 */
export class ResultBoundary extends Component<ResultBoundaryProps, ResultBoundaryState> {
  constructor(props: ResultBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  
  static getDerivedStateFromError(error: Error): ResultBoundaryState {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error }
  }
  
  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error to error reporting service
    this.props.onError?.(error, errorInfo)
  }
  
  reset = () => {
    this.setState({ hasError: false, error: null })
  }
  
  override render() {
    if (this.state.hasError && this.state.error) {
      // Convert the error to a Result and pass to fallback
      const result = ZT.err(this.state.error) as Result<never, Error>
      return this.props.fallback(result, this.reset)
    }
    
    return this.props.children
  }
}