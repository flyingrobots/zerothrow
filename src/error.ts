
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
}
