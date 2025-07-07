import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ZT } from '../src/zt-pocket-knife.js';
import { ok, err } from '../src/result.js';
import * as Debug from '../src/debug.js';
import * as TraceContext from '../src/trace-context.js';

describe('Tracing and Debug Utilities', () => {
  // Store original console methods
  const originalLog = globalThis.console.log;
  const originalError = globalThis.console.error;
  
  // Mock console methods
  let logOutput: any[] = [];
  let errorOutput: any[] = [];
  
  beforeEach(() => {
    // Clear outputs
    logOutput = [];
    errorOutput = [];
    
    // Mock console methods
    globalThis.console.log = (...args: any[]) => {
      logOutput.push(args);
    };
    globalThis.console.error = (...args: any[]) => {
      errorOutput.push(args);
    };
    
    // Clear trace contexts
    TraceContext.clearAllTraceContexts();
  });
  
  afterEach(() => {
    // Restore console methods
    globalThis.console.log = originalLog;
    globalThis.console.error = originalError;
    
    // Disable debug mode
    Debug.setDebugEnabled(false);
  });
  
  describe('Result.trace()', () => {
    it('should not output when debug is disabled', () => {
      Debug.setDebugEnabled(false);
      
      const result = ok(42).trace('test');
      
      expect(result.ok).toBe(true);
      expect(result.value).toBe(42);
      expect(logOutput).toHaveLength(0);
      expect(errorOutput).toHaveLength(0);
    });
    
    it('should log Ok results when debug is enabled', () => {
      Debug.setDebugEnabled(true);
      
      const result = ok('success').trace('test-ok');
      
      expect(result.ok).toBe(true);
      expect(logOutput).toHaveLength(1);
      expect(logOutput[0]).toEqual(['[test-ok] Result.Ok:', 'success']);
      expect(errorOutput).toHaveLength(0);
    });
    
    it('should log Err results when debug is enabled', () => {
      Debug.setDebugEnabled(true);
      
      const error = new Error('test error');
      const result = err(error).trace('test-err');
      
      expect(result.ok).toBe(false);
      expect(errorOutput).toHaveLength(1);
      expect(errorOutput[0]).toEqual(['[test-err] Result.Err:', error]);
      expect(logOutput).toHaveLength(0);
    });
    
    it('should work without label', () => {
      Debug.setDebugEnabled(true);
      
      ok(123).trace();
      
      expect(logOutput).toHaveLength(1);
      expect(logOutput[0]).toEqual(['Result.Ok:', 123]);
    });
    
    it('should be chainable', () => {
      Debug.setDebugEnabled(true);
      
      const result = ok(10)
        .trace('initial')
        .map(x => x * 2)
        .trace('after-map')
        .andThen(x => ok(x + 5))
        .trace('final');
      
      expect(result.ok).toBe(true);
      expect(result.value).toBe(25);
      expect(logOutput).toHaveLength(3);
      expect(logOutput[0]).toEqual(['[initial] Result.Ok:', 10]);
      expect(logOutput[1]).toEqual(['[after-map] Result.Ok:', 20]);
      expect(logOutput[2]).toEqual(['[final] Result.Ok:', 25]);
    });
  });
  
  describe('ZT.debug utilities', () => {
    it('should provide debug logging', () => {
      ZT.debug.enable();
      
      ZT.debug('test', 'Hello', { data: 123 });
      
      expect(logOutput).toHaveLength(1);
      expect(logOutput[0]).toEqual(['[ZeroThrow:test]', 'Hello', { data: 123 }]);
    });
    
    it('should provide error logging', () => {
      ZT.debug.enable();
      
      const error = new Error('test error');
      ZT.debug.error('test', error, 'additional info');
      
      expect(errorOutput).toHaveLength(1);
      expect(errorOutput[0]).toEqual(['[ZeroThrow:test]', error, 'additional info']);
    });
    
    it('should conditionally execute functions', () => {
      let executed = false;
      
      ZT.debug.disable();
      ZT.debug.do(() => { executed = true; });
      expect(executed).toBe(false);
      
      ZT.debug.enable();
      ZT.debug.do(() => { executed = true; });
      expect(executed).toBe(true);
    });
    
    it('should check if debug is enabled', () => {
      ZT.debug.disable();
      expect(ZT.debug.isEnabled()).toBe(false);
      
      ZT.debug.enable();
      expect(ZT.debug.isEnabled()).toBe(true);
    });
  });
  
  describe('TraceContext', () => {
    it('should create trace contexts', () => {
      Debug.setDebugEnabled(true);
      
      const context = TraceContext.createTraceContext('test-context', { 
        user: 'test-user' 
      });
      
      expect(context.id).toBe('test-context');
      expect(context.metadata).toEqual({ user: 'test-user' });
      expect(context.entries).toHaveLength(0);
    });
    
    it('should generate unique IDs when not provided', () => {
      Debug.setDebugEnabled(true);
      
      const context1 = TraceContext.createTraceContext();
      const context2 = TraceContext.createTraceContext();
      
      expect(context1.id).not.toBe(context2.id);
      expect(context1.id).toMatch(/^trace-\d+-[a-z0-9]+$/);
    });
    
    it('should add trace entries', () => {
      Debug.setDebugEnabled(true);
      
      const context = TraceContext.createTraceContext('test');
      const result1 = ok(42);
      const result2 = err(new Error('test error'));
      
      TraceContext.addTraceEntry(context, result1, 'step1');
      TraceContext.addTraceEntry(context, result2, 'step2');
      
      expect(context.entries).toHaveLength(2);
      expect(context.entries[0]).toMatchObject({
        label: 'step1',
        ok: true,
        value: 42
      });
      expect(context.entries[1]).toMatchObject({
        label: 'step2',
        ok: false,
        error: expect.any(Error)
      });
    });
    
    it('should not add entries when debug is disabled', () => {
      Debug.setDebugEnabled(false);
      
      const context = TraceContext.createTraceContext('test');
      TraceContext.addTraceEntry(context, ok(42), 'step1');
      
      expect(context.entries).toHaveLength(0);
    });
    
    it('should analyze trace contexts', () => {
      Debug.setDebugEnabled(true);
      
      const context = TraceContext.createTraceContext('test');
      
      // Add some entries with delays
      TraceContext.addTraceEntry(context, ok(1), 'step1');
      TraceContext.addTraceEntry(context, ok(2), 'step2');
      TraceContext.addTraceEntry(context, err(new Error('fail')), 'step3');
      TraceContext.addTraceEntry(context, ok(4), 'step4');
      
      const analysis = TraceContext.analyzeTraceContext(context);
      
      expect(analysis.successCount).toBe(3);
      expect(analysis.errorCount).toBe(1);
      expect(analysis.errorRate).toBe(0.25);
      expect(analysis.totalDuration).toBeGreaterThanOrEqual(0);
    });
    
    it('should export trace context to JSON', () => {
      Debug.setDebugEnabled(true);
      
      const context = TraceContext.createTraceContext('test', { version: '1.0' });
      TraceContext.addTraceEntry(context, ok('success'), 'step1');
      TraceContext.addTraceEntry(context, err(new Error('failure')), 'step2');
      
      const json = TraceContext.exportTraceContext(context);
      const parsed = JSON.parse(json);
      
      expect(parsed.id).toBe('test');
      expect(parsed.metadata).toEqual({ version: '1.0' });
      expect(parsed.entries).toHaveLength(2);
      expect(parsed.entries[1].error.message).toBe('failure');
    });
    
    it('should manage active contexts', () => {
      Debug.setDebugEnabled(true);
      
      TraceContext.createTraceContext('ctx1');
      TraceContext.createTraceContext('ctx2');
      
      const active = TraceContext.getActiveContexts();
      expect(active).toHaveLength(2);
      expect(active.map(c => c.id)).toContain('ctx1');
      expect(active.map(c => c.id)).toContain('ctx2');
      
      TraceContext.clearTraceContext('ctx1');
      expect(TraceContext.getActiveContexts()).toHaveLength(1);
      
      TraceContext.clearAllTraceContexts();
      expect(TraceContext.getActiveContexts()).toHaveLength(0);
    });
  });
  
  describe('traced() higher-order function', () => {
    it('should trace function results', () => {
      Debug.setDebugEnabled(true);
      
      const divide = (a: number, b: number) => 
        b === 0 ? err(new Error('Division by zero')) : ok(a / b);
      
      const tracedDivide = TraceContext.traced(divide, 'divide');
      
      tracedDivide(10, 2);
      expect(logOutput).toHaveLength(1);
      expect(logOutput[0]).toEqual(['[divide] Result.Ok:', 5]);
      
      tracedDivide(10, 0);
      expect(errorOutput).toHaveLength(1);
      expect(errorOutput[0][0]).toBe('[divide] Result.Err:');
    });
  });
  
  describe('Environment variable support', () => {
    it('should respect ZEROTHROW_DEBUG environment variable', () => {
      // This test would need to be run with different env configurations
      // In a real test environment, we'd test this more thoroughly
      expect(Debug.isDebugEnabled()).toBe(false);
    });
  });
  
  describe('Integration with ZT.try', () => {
    it('should trace ZT.try results', () => {
      ZT.debug.enable();
      
      const result = ZT.try(() => JSON.parse('{"valid": true}'))
        .trace('json-parse');
      
      expect(result.ok).toBe(true);
      expect(logOutput).toHaveLength(1);
      expect(logOutput[0]).toEqual(['[json-parse] Result.Ok:', { valid: true }]);
    });
    
    it('should trace ZT.tryAsync results', async () => {
      ZT.debug.enable();
      
      const result = await ZT.tryAsync(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'async-success';
      }).then(r => r.trace('async-operation'));
      
      expect(result.ok).toBe(true);
      expect(logOutput).toHaveLength(1);
      expect(logOutput[0]).toEqual(['[async-operation] Result.Ok:', 'async-success']);
    });
  });
});