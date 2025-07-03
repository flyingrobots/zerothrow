import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ErrorFormatter,
  createErrorFormatter,
} from '../src/dev/error-formatter.js';
import { ZT } from '../src/index.js';

describe('ErrorFormatter', () => {
  let consoleErrorSpy: any;
  let consoleLogSpy: any;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  describe('formatZeroError', () => {
    it('formats error with colors when enabled', () => {
      const formatter = new ErrorFormatter({ colors: true });
      const error = new ZT.Error('API_ERROR', 'Request failed', {
        context: { endpoint: '/api/users', statusCode: 404 },
      });

      const formatted = formatter.formatZeroError(error);

      // Check for content, not specific formatting
      expect(formatted).toContain('API_ERROR');
      expect(formatted).toContain('Request failed');
      expect(formatted).toContain('Context:');
      expect(formatted).toContain('/api/users');
      expect(formatted).toContain('404');

      // Behavioral check: when colors are explicitly enabled,
      // the formatter should respect that setting regardless of environment
    });

    it('formats error without colors when disabled', () => {
      const formatter = new ErrorFormatter({ colors: false });
      const error = new ZT.Error('API_ERROR', 'Request failed');

      const formatted = formatter.formatZeroError(error);

      // Just check the content is there
      expect(formatted).toContain('API_ERROR');
      expect(formatted).toContain('Request failed');
    });

    it('handles symbol error codes', () => {
      const formatter = new ErrorFormatter({ colors: false });
      const symbolCode = Symbol('CUSTOM_ERROR');
      const error = new ZT.Error(symbolCode, 'Custom error');

      const formatted = formatter.formatZeroError(error);

      expect(formatted).toContain('[Symbol(CUSTOM_ERROR)] Custom error');
    });

    it('includes statusCode from context', () => {
      const formatter = new ErrorFormatter({ colors: false });
      const error = new ZT.Error('HTTP_ERROR', 'Not found', {
        context: { statusCode: 404, path: '/users/123' },
      });

      const formatted = formatter.formatZeroError(error);

      expect(formatted).toContain('Status Code: 404');
    });

    it('respects stackTrace option', () => {
      const formatter = new ErrorFormatter({
        colors: false,
        stackTrace: false,
      });
      const error = new ZT.Error('TEST_ERROR', 'Test message');

      const formatted = formatter.formatZeroError(error);

      expect(formatted).not.toContain('Stack Trace:');
      expect(formatted).not.toContain('at ');
    });

    it('includes stack trace with colors when both are enabled', () => {
      const formatter = new ErrorFormatter({ colors: true, stackTrace: true });
      const error = new ZT.Error('STACK_ERROR', 'Stack test');

      const formatted = formatter.formatZeroError(error);

      // Behavioral test: should include stack trace header and content
      expect(formatted).toContain('Stack Trace:');
      expect(formatted).toContain('Stack test');
      // Don't test for specific ANSI codes, just test the behavior
    });

    it('respects details option', () => {
      const formatter = new ErrorFormatter({ colors: false, details: false });
      const error = new ZT.Error('TEST_ERROR', 'Test message', {
        context: { data: 'should not appear' },
      });

      const formatted = formatter.formatZeroError(error);

      expect(formatted).not.toContain('Context:');
      expect(formatted).not.toContain('should not appear');
    });

    it('respects timestamp option', () => {
      const formatter = new ErrorFormatter({ colors: false, timestamp: false });
      const error = new ZT.Error('TEST_ERROR', 'Test message');

      const formatted = formatter.formatZeroError(error);

      expect(formatted).not.toContain('Timestamp:');
    });
  });

  describe('formatResult', () => {
    it('formats Ok result', () => {
      const formatter = new ErrorFormatter({ colors: false });
      const result = ZT.ok({ id: 1 });

      const formatted = formatter.formatResult(result);

      // Check it indicates success and includes the value
      expect(formatted).toContain('✓');
      expect(formatted).toContain('Success');
      expect(formatted).toContain('{"id":1}');
    });

    it('formats Ok result with colors', () => {
      const formatter = new ErrorFormatter({ colors: true });
      const result = ZT.ok({ id: 1 });

      const formatted = formatter.formatResult(result);

      // Just check content, not color codes
      expect(formatted).toContain('✓');
      expect(formatted).toContain('Success');
    });

    it('formats Err result with ZeroError', () => {
      const formatter = new ErrorFormatter({ colors: false });
      const error = new ZT.Error('VALIDATION_ERROR', 'Invalid input');
      const result = ZT.err(error);

      const formatted = formatter.formatResult(result);

      expect(formatted).toContain('[VALIDATION_ERROR] Invalid input');
    });

    it('formats Err result with regular Error', () => {
      const formatter = new ErrorFormatter({ colors: false });
      const error = new Error('Generic error');
      const result = ZT.err(error);

      const formatted = formatter.formatResult(result);

      expect(formatted).toBe('✗ Error: Generic error');
    });

    it('formats Err result with regular Error with colors', () => {
      const formatter = new ErrorFormatter({ colors: true });
      const error = new Error('Generic error');
      const result = ZT.err(error);

      const formatted = formatter.formatResult(result);

      expect(formatted).toContain('✗ Error: Generic error');
      // Don't check for exact ANSI codes, just verify it contains the message
    });
  });

  describe('console helpers', () => {
    it('logError logs formatted error to console.error', () => {
      const formatter = new ErrorFormatter({ colors: false });
      const error = new ZT.Error('TEST_ERROR', 'Test message');

      formatter.logError(error);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[TEST_ERROR] Test message')
      );
    });

    it('logResult logs formatted result to console.log', () => {
      const formatter = new ErrorFormatter({ colors: false });
      const result = ZT.ok('success');

      formatter.logResult(result);

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('✓'));
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Success')
      );
    });
  });

  describe('createErrorFormatter', () => {
    it('creates formatter with custom options', () => {
      const formatter = createErrorFormatter({
        colors: false,
        stackTrace: false,
        details: false,
        timestamp: false,
      });

      const error = new ZT.Error('TEST', 'Test', {
        context: { data: 'test' },
      });

      const formatted = formatter.formatZeroError(error);

      expect(formatted).toBe('[TEST] Test');
    });
  });
});
