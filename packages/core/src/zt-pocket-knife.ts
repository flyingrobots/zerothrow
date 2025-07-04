/**
 * ZT Pocket Knife - Ultra-lean three-function surface
 * The 99% use case: ZT.try(), ZT.ok(), ZT.err()
 */

import { 
  try as _try, 
  ok as _ok, 
  err as _err 
} from './core-exports.js';

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
 */
export const ZT = {
  try: _try,
  ok: _ok,
  err: _err
} as const;