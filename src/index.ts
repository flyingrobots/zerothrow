// Re-export everything from core-exports as ZeroThrow namespace
export * as ZeroThrow from './core-exports.js';

// Export the pocket knife
export { ZT } from './zt-pocket-knife.js';

// Legacy exports for backward compatibility (will be deprecated)
export { ZeroError, type ErrorCode, type ErrorContext } from './error.js';
export {
  ok,
  err,
  tryR,
  tryRSync,
  tryRBatch,
  wrap,
  type Ok,
  type Err,
  type Result,
} from './result.js';
export {
  type ResultCombinable,
  makeCombinable,
  pipe,
  collect,
  collectAsync,
  firstSuccess,
} from './combinators.js';

// Keep the old ZT namespace for now (will be removed)
import * as _ZT from './zt.js';
export { _ZT as ZT_OLD };
