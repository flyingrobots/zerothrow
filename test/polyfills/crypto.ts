/**
 * Crypto polyfill for Node 16 compatibility
 * Node 16 doesn't have crypto.getRandomValues in global scope
 */

// Check if we need to polyfill
if (typeof globalThis.crypto === 'undefined') {
  const crypto = require('crypto');
  
  globalThis.crypto = {
    getRandomValues: function<T extends ArrayBufferView>(array: T): T {
      // Use Node's crypto.randomFillSync for Node 16 compatibility
      return crypto.randomFillSync(array) as T;
    }
  } as Crypto;
} else if (!globalThis.crypto.getRandomValues) {
  // crypto exists but doesn't have getRandomValues
  const crypto = require('crypto');
  
  globalThis.crypto.getRandomValues = function<T extends ArrayBufferView>(array: T): T {
    return crypto.randomFillSync(array) as T;
  };
}

export {};