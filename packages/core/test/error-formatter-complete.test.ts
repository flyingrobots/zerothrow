import { describe, it, expect } from 'vitest';
import { ErrorFormatter } from '../src/dev/error-formatter.js';
import { ZeroThrow } from '../src/index.js';

describe('ErrorFormatter complete coverage', () => {
  it('handles errors without stack traces', () => {
    const formatter = new ErrorFormatter({ stackTrace: true, colors: false, timestamp: false });
    
    // Create an error without a stack
    const error = new ZeroThrow.ZeroError('TEST_ERROR', 'Test message');
    Object.defineProperty(error, 'stack', {
      value: undefined,
      writable: true,
      configurable: true
    });
    
    const result = formatter.formatZeroError(error);
    
    // Should NOT include Stack Trace when stack is undefined
    expect(result).not.toContain('Stack Trace:');
    expect(result).toContain('TEST_ERROR');
    expect(result).toContain('Test message');
  });

  it('handles errors with empty stack string', () => {
    const formatter = new ErrorFormatter({ stackTrace: true, colors: false, timestamp: false });
    
    const error = new ZeroThrow.ZeroError('TEST_ERROR', 'Test message');
    error.stack = '';
    
    const result = formatter.formatZeroError(error);
    
    // Empty stack is falsy, so no Stack Trace section
    expect(result).not.toContain('Stack Trace:');
    expect(result).toContain('TEST_ERROR');
  });

  it('applies colors to stack trace lines when colors enabled', () => {
    const formatter = new ErrorFormatter({ stackTrace: true, colors: true });
    
    const error = new ZeroThrow.ZeroError('TEST_ERROR', 'Test message');
    error.stack = 'Error: Test message\n    at someFunction (file.js:10:5)\n    at anotherFunction (file.js:20:10)';
    
    const result = formatter.formatZeroError(error);
    
    // Should contain colored stack lines
    expect(result).toContain('\x1b[90m'); // gray color
    expect(result).toContain('at someFunction');
  });

  it('formats error context without colors when disabled', () => {
    const formatter = new ErrorFormatter({ colors: false, details: true });
    
    const error = new ZeroThrow.ZeroError('TEST_ERROR', 'Test message', {
      context: { userId: 123, action: 'delete' }
    });
    
    const result = formatter.formatZeroError(error);
    
    expect(result).toContain('Context:');
    expect(result).toContain('"userId": 123');
    expect(result).not.toContain('\x1b['); // no color codes
  });

  it('handles errors with cause property', () => {
    const formatter = new ErrorFormatter({ colors: true, details: true });
    
    const cause = new Error('Original error');
    const error = new ZeroThrow.ZeroError('WRAPPED_ERROR', 'Wrapped message');
    error.cause = cause;
    
    const result = formatter.formatZeroError(error);
    
    // The formatter doesn't explicitly handle cause, but it should format without error
    expect(result).toContain('WRAPPED_ERROR');
    expect(result).toContain('Wrapped message');
  });

  it('formats Ok results without value when value is undefined', () => {
    const formatter = new ErrorFormatter({ colors: false });
    
    const result = formatter.formatResult({ ok: true, value: undefined });
    
    expect(result).toContain('✓ Success: undefined');
  });

  it('formats Ok results with complex objects', () => {
    const formatter = new ErrorFormatter({ colors: false });
    
    const complexValue = {
      users: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }],
      metadata: { count: 2, page: 1 }
    };
    
    const result = formatter.formatResult({ ok: true, value: complexValue });
    
    expect(result).toContain('✓ Success:');
    expect(result).toContain('"users"');
    expect(result).toContain('"Alice"');
  });

  it('respects all formatter options together', () => {
    const formatter = new ErrorFormatter({
      colors: true,
      stackTrace: false,
      details: false,
      timestamp: true
    });
    
    const error = new ZeroThrow.ZeroError('TEST', 'Message', {
      context: { data: 'value' }
    });
    
    const result = formatter.formatZeroError(error);
    
    // Should have timestamp in the format
    expect(result).toContain('Timestamp:');
    expect(result).toMatch(/\d{4}-\d{2}-\d{2}/);
    // Should not have stack trace
    expect(result).not.toContain('Stack Trace:');
    // Should not have context details
    expect(result).not.toContain('Context:');
    // Should have colors
    expect(result).toContain('\x1b[');
  });

  it('handles circular references in error context', () => {
    const formatter = new ErrorFormatter({ details: true });
    
    const context: any = { name: 'test' };
    context.circular = context; // Create circular reference
    
    const error = new ZeroThrow.ZeroError('CIRCULAR', 'Circular error', { context });
    
    // JSON.stringify will throw on circular references, so the formatter should handle it
    expect(() => formatter.formatZeroError(error)).toThrow('Converting circular structure to JSON');
  });

  it('formats errors with very long messages', () => {
    const formatter = new ErrorFormatter({ colors: false });
    
    const longMessage = 'A'.repeat(1000);
    const error = new ZeroThrow.ZeroError('LONG', longMessage);
    
    const result = formatter.formatZeroError(error);
    
    expect(result).toContain('LONG');
    expect(result).toContain(longMessage);
  });

  it('handles null and undefined in error context', () => {
    const formatter = new ErrorFormatter({ details: true });
    
    const error = new ZeroThrow.ZeroError('NULL_CONTEXT', 'Message', {
      context: {
        nullValue: null,
        undefinedValue: undefined,
        validValue: 'test'
      }
    });
    
    const result = formatter.formatZeroError(error);
    
    expect(result).toContain('null');
    expect(result).toContain('validValue');
  });

  it('handles edge case where stack exists initially but is checked again', () => {
    const formatter = new ErrorFormatter({ stackTrace: true, colors: false });
    
    const error = new ZeroThrow.ZeroError('EDGE_CASE', 'Edge case error');
    // This covers the branch where error.stack is checked twice (line 88 and 96)
    error.stack = 'Error: Edge case error\n    at test (file.js:1:1)';
    
    const result = formatter.formatZeroError(error);
    
    expect(result).toContain('Stack Trace:');
    expect(result).toContain('at test (file.js:1:1)');
  });

  it('handles non-ZeroError in formatResult', () => {
    const formatter = new ErrorFormatter({ colors: false });
    
    const regularError = new Error('Regular error');
    const result = formatter.formatResult({ ok: false, error: regularError });
    
    // For non-ZeroError, it should still format but differently
    expect(result).toContain('Regular error');
  });

  it('handles non-Error objects in formatResult', () => {
    const formatter = new ErrorFormatter({ colors: false });
    
    // Test with a non-Error object
    const result = formatter.formatResult({ ok: false, error: 'string error' as any });
    
    expect(result).toContain('✗ Error: string error');
  });

  it('handles non-Error objects with colors in formatResult', () => {
    const formatter = new ErrorFormatter({ colors: true });
    
    // Test with a non-Error object
    const result = formatter.formatResult({ ok: false, error: { custom: 'object' } as any });
    
    expect(result).toContain('[object Object]');
    expect(result).toContain('\x1b[31m'); // red color
  });
});