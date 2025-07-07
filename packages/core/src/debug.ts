/**
 * Debug utilities for ZeroThrow
 * Zero-cost when disabled, powerful when enabled
 */

// Internal state for debug configuration
let debugEnabled: boolean | undefined;

/**
 * Check if debug mode is enabled
 * Caches the result for performance
 */
export function isDebugEnabled(): boolean {
  if (debugEnabled !== undefined) return debugEnabled;

  // Check for Node.js environment
  if (typeof process !== 'undefined' && process.env) {
    debugEnabled = process.env['ZEROTHROW_DEBUG'] === 'true' || process.env['ZEROTHROW_DEBUG'] === '1';
    return debugEnabled;
  }
  
  // Check for browser environment
  if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis) {
    try {
      const stored = globalThis.localStorage.getItem('ZEROTHROW_DEBUG');
      debugEnabled = stored === 'true' || stored === '1';
      return debugEnabled;
    } catch {
      // localStorage might throw in some environments
    }
  }
  
  debugEnabled = false;
  return debugEnabled;
}

/**
 * Enable or disable debug mode at runtime
 */
export function setDebugEnabled(enabled: boolean): void {
  debugEnabled = enabled;
  
  // Persist to environment if possible
  if (typeof process !== 'undefined' && process.env) {
    process.env['ZEROTHROW_DEBUG'] = enabled ? '1' : '0';
  }
  
  // Persist to localStorage if possible
  if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis) {
    try {
      globalThis.localStorage.setItem('ZEROTHROW_DEBUG', enabled ? '1' : '0');
    } catch {
      // localStorage might throw in some environments
    }
  }
}

/**
 * Debug logging utility
 * Only outputs when debug mode is enabled
 */
export function debug(label: string, ...args: unknown[]): void {
  if (!isDebugEnabled()) return;
  
  if (typeof globalThis !== 'undefined' && globalThis.console) {
    globalThis.console.log(`[ZeroThrow:${label}]`, ...args);
  }
}

/**
 * Debug error logging utility
 * Only outputs when debug mode is enabled
 */
export function debugError(label: string, error: Error, ...args: unknown[]): void {
  if (!isDebugEnabled()) return;
  
  if (typeof globalThis !== 'undefined' && globalThis.console) {
    globalThis.console.error(`[ZeroThrow:${label}]`, error, ...args);
  }
}

/**
 * Conditional debug execution
 * Function is only called when debug mode is enabled
 */
export function debugDo(fn: () => void): void {
  if (isDebugEnabled()) {
    fn();
  }
}