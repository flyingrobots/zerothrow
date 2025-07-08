/**
 * @zerothrow/react - React hooks for type-safe error handling
 * 
 * Stop throwing, start returning.
 */

export { useResult } from './hooks/useResult.js'
export { useResilientResult } from './hooks/useResilientResult.js'
export { useResultContext, useResultContextNullable, createResultContext } from './hooks/useResultContext.js'
export { useStateIntrospection } from './hooks/useStateIntrospection.js'
export { ResultBoundary } from './components/ResultBoundary.js'
export { ResultDevTools } from './devtools/ResultDevTools.js'

export type { UseResultReturn, UseResultOptions } from './hooks/useResult.js'
export type { UseResilientResultReturn, UseResilientResultOptions } from './hooks/useResilientResult.js'
export type { ContextError } from './hooks/useResultContext.js'
export type { ResultBoundaryProps } from './components/ResultBoundary.js'
export type { 
  UseStateIntrospectionOptions,
  UseStateIntrospectionReturn,
  IntrospectionData,
  DebugInfo
} from './hooks/useStateIntrospection.js'
export type { 
  ResultDevToolsProps,
  DevToolsPosition,
  DevToolsTheme
} from './devtools/ResultDevTools.js'

// Advanced state introspection types
export type {
  LoadingState,
  LoadingFlags,
  IdleState,
  PendingState,
  RefreshingState,
  RetryingState,
  SuccessState,
  ErrorState
} from './types/loading.js'
export type {
  HistoryEntry,
  Metrics,
  TriggerType
} from './utils/stateHistory.js'

// Re-export core for convenience
export { ZT, ZeroThrow } from '@zerothrow/core'
export type { Result } from '@zerothrow/core'