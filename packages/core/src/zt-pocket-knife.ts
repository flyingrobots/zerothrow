/**
 * ZT Pocket Knife - Ultra-lean core functions for daily use
 * The 99% use case: ZT.try(), ZT.ok(), ZT.err(), ZT.debug()
 */

import { 
  try as _try,
  tryAsync as _tryAsync,
  ok as _ok, 
  err as _err 
} from './core-exports.js';

import {
  debug as _debug,
  debugError as _debugError,
  debugDo as _debugDo,
  setDebugEnabled as _setDebugEnabled,
  isDebugEnabled as _isDebugEnabled
} from './debug.js';

/**
 * ZT - The pocket knife for daily ZeroThrow use
 * 
 * @example
 * ```typescript
 * import { ZT } from '@zerothrow/zerothrow';
 * 
 * const result = ZT.try(() => JSON.parse(input));
 * if (!result.ok) {
 *   return ZT.err(new Error('Invalid JSON'));
 * }
 * return ZT.ok(result.value);
 * ```
 * 
 * @example
 * ```typescript
 * // Enable debugging
 * ZT.debug.enable();
 * 
 * // Debug logging
 * ZT.debug('parser', 'Starting JSON parse', input);
 * 
 * const result = ZT.try(() => JSON.parse(input))
 *   .trace('json-parse');
 * ```
 */
export const ZT = {
  try: _try,
  tryAsync: _tryAsync,
  ok: _ok,
  err: _err,
  debug: Object.assign(_debug, {
    error: _debugError,
    do: _debugDo,
    enable: () => _setDebugEnabled(true),
    disable: () => _setDebugEnabled(false),
    isEnabled: _isDebugEnabled
  })
} as const;