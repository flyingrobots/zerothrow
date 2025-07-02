
export type ErrorCode = string | number | symbol;

export interface ErrorContext { [k: string]: unknown }

/**
 * ZeroError wraps a standard JS Error but adds:
 *  - code      : machine‑readable categorisation
 *  - context   : structured payload for logging
 *  - cause     : native Error.cause chain (ES2022)
 */
export class ZeroError<C extends ErrorContext = ErrorContext> extends Error {
  readonly code: ErrorCode;
  readonly context?: C;

  constructor(
    code: ErrorCode,
    message: string,
    opts: { cause?: Error; context?: C } = {}
  ) {
    super(message, { cause: opts.cause });
    this.code = code;
    this.context = opts.context;
    this.name = "ZeroError";
    Object.setPrototypeOf(this, new.target.prototype); // fix prototype when transpiled
  }

  /**
   * Override toString to include full error chain with context
   */
  toString(): string {
    let result = `${this.name} [${String(this.code)}]: ${this.message}`;
    
    // Add context if present
    if (this.context && Object.keys(this.context).length > 0) {
      result += `\n  Context: ${JSON.stringify(this.context, null, 2).replace(/\n/g, '\n  ')}`;
    }
    
    // Add cause chain
    let currentCause = this.cause;
    let depth = 1;
    while (currentCause instanceof Error) {
      const indent = '  '.repeat(depth);
      const causeName = currentCause.name || 'Error';
      result += `\n${indent}Caused by: ${causeName}: ${currentCause.message}`;
      
      // If the cause is also a ZeroError, include its context
      if (currentCause instanceof ZeroError && currentCause.context) {
        const contextStr = JSON.stringify(currentCause.context, null, 2).replace(/\n/g, `\n${indent}  `);
        result += `\n${indent}  Context: ${contextStr}`;
      }
      
      currentCause = currentCause.cause;
      depth++;
    }
    
    return result;
  }

  /**
   * Get the full stack trace including all causes
   */
  getFullStack(): string {
    let fullStack = this.stack || '';
    
    let currentCause = this.cause;
    while (currentCause instanceof Error) {
      fullStack += '\n\nCaused by:\n' + (currentCause.stack || currentCause.toString());
      currentCause = currentCause.cause;
    }
    
    return fullStack;
  }
}
