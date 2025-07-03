import { ZT } from '../index.js';

interface FormatOptions {
  colors?: boolean;
  stackTrace?: boolean;
  details?: boolean;
  timestamp?: boolean;
}

const COLORS = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

export class ErrorFormatter {
  private options: FormatOptions;

  constructor(options: FormatOptions = {}) {
    // Auto-detect color support if not explicitly set
    const supportsColor =
      options.colors ??
      (typeof process === 'object' &&
        typeof process.stdout === 'object' &&
        process.stdout.isTTY);

    this.options = {
      colors: supportsColor,
      stackTrace: true,
      details: true,
      timestamp: true,
      ...options,
    };
  }

  formatZeroError(error: ZT.Error): string {
    const lines: string[] = [];
    const { colors } = this.options;

    // Header with error code
    const codeStr =
      typeof error.code === 'symbol' ? String(error.code) : String(error.code);
    const header = colors
      ? `${COLORS.red}${COLORS.bold}[${codeStr}]${COLORS.reset} ${COLORS.red}${error.message}${COLORS.reset}`
      : `[${codeStr}] ${error.message}`;
    lines.push(header);

    // Context
    if (error.context && 'statusCode' in error.context) {
      const statusLine = colors
        ? `${COLORS.gray}Status Code: ${COLORS.yellow}${error.context.statusCode}${COLORS.reset}`
        : `Status Code: ${error.context.statusCode}`;
      lines.push(statusLine);
    }

    // Timestamp
    if (this.options.timestamp) {
      const timestamp = new Date().toISOString();
      const timestampLine = colors
        ? `${COLORS.gray}Timestamp: ${timestamp}${COLORS.reset}`
        : `Timestamp: ${timestamp}`;
      lines.push(timestampLine);
    }

    // Context details
    if (this.options.details && error.context) {
      lines.push('');
      const detailsHeader = colors
        ? `${COLORS.blue}Context:${COLORS.reset}`
        : 'Context:';
      lines.push(detailsHeader);

      const detailsStr = JSON.stringify(error.context, null, 2);
      const detailsLines = detailsStr
        .split('\n')
        .map((line) =>
          colors ? `${COLORS.gray}  ${line}${COLORS.reset}` : `  ${line}`
        );
      lines.push(...detailsLines);
    }

    // Stack trace
    if (this.options.stackTrace && error.stack) {
      lines.push('');
      const stackHeader = colors
        ? `${COLORS.blue}Stack Trace:${COLORS.reset}`
        : 'Stack Trace:';
      lines.push(stackHeader);

      const stackLines = (
        error.stack ? error.stack.split('\n').slice(1) : []
      ).map((line) => (colors ? `${COLORS.gray}${line}${COLORS.reset}` : line));
      lines.push(...stackLines);
    }

    return lines.join('\n');
  }

  formatResult<T, E extends Error>(result: ZT.Result<T, E>): string {
    if (result.ok) {
      const { colors } = this.options;
      const valueStr = JSON.stringify(result.value);
      return colors
        ? `${COLORS.green}✓ Success: ${valueStr}${COLORS.reset}`
        : `✓ Success: ${valueStr}`;
    } else {
      const error = result.error;
      if (error instanceof ZT.Error) {
        return this.formatZeroError(error);
      } else {
        const { colors } = this.options;
        const errorStr = error instanceof Error ? error.message : String(error);
        return colors
          ? `${COLORS.red}✗ Error: ${errorStr}${COLORS.reset}`
          : `✗ Error: ${errorStr}`;
      }
    }
  }

  // Console helper methods
  logError(error: ZT.Error): void {
    // eslint-disable-next-line no-console
    console.error(this.formatZeroError(error));
  }

  logResult<T, E extends Error>(result: ZT.Result<T, E>): void {
    // eslint-disable-next-line no-console
    console.log(this.formatResult(result));
  }
}

// Export singleton instance with default options
export const errorFormatter = new ErrorFormatter();

// Export factory function for custom options
export function createErrorFormatter(options: FormatOptions): ErrorFormatter {
  return new ErrorFormatter(options);
}
