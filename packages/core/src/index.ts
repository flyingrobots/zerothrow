// Re-export everything from core-exports as ZeroThrow namespace
export * as ZeroThrow from './core-exports.js';

// Export the pocket knife
export { ZT } from './zt-pocket-knife.js';

// Export commonly used types at top level for convenience
export type { 
  Result, 
  Ok, 
  Err,
  ErrorCode,
  ErrorContext 
} from './core-exports.js';

// Export ZeroError class for creating custom errors
export { ZeroError } from './core-exports.js';

// Export debug utilities
export * as Debug from './debug.js';

// Export trace context utilities
export * as TraceContext from './trace-context.js';
