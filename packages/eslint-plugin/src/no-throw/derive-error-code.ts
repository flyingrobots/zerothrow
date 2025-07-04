/**
 * Derives an error code from an error message using common patterns.
 * Returns string error codes only (ZeroError supports string | number | symbol).
 */
export function deriveErrorCode(message: string): string {
  const patterns = [
    { regex: /not found/i, code: 'NOT_FOUND' },
    { regex: /unauthorized|not authorized/i, code: 'UNAUTHORIZED' },
    { regex: /forbidden|access denied/i, code: 'FORBIDDEN' },
    { regex: /invalid|validation/i, code: 'VALIDATION_ERROR' },
    { regex: /timeout|timed out/i, code: 'TIMEOUT' },
    { regex: /network|connection/i, code: 'NETWORK_ERROR' },
    { regex: /database|db/i, code: 'DATABASE_ERROR' },
    { regex: /conflict/i, code: 'CONFLICT' },
    { regex: /rate limit/i, code: 'RATE_LIMIT' },
    { regex: /not implemented/i, code: 'NOT_IMPLEMENTED' },
  ];

  for (const { regex, code } of patterns) {
    if (regex.test(message)) {
      return code;
    }
  }

  return 'TODO_ERROR_CODE';
}
