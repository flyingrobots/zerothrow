/**
 * @zerothrow/react - React hooks for type-safe error handling
 * 
 * Stop throwing, start returning.
 */

export { useResult } from './hooks/useResult.js'
export { useResilientResult } from './hooks/useResilientResult.js'
export { ResultBoundary } from './components/ResultBoundary.js'

export type { UseResultReturn, UseResultOptions } from './hooks/useResult.js'
export type { UseResilientResultReturn, UseResilientResultOptions } from './hooks/useResilientResult.js'
export type { ResultBoundaryProps } from './components/ResultBoundary.js'

// Re-export core for convenience
export { ZT, ZeroThrow } from '@zerothrow/core'
export type { Result } from '@zerothrow/core'