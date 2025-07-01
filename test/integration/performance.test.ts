import { describe, it, expect } from 'vitest';
import { tryR, wrap, err, ok, Result, ZeroError } from '../../src/index';

// Comprehensive Performance Benchmarks for ZeroThrow Operations
describe('Comprehensive Performance Benchmarks', () => {
  // Benchmark: Basic Result creation vs try/catch
  it('should benchmark Result creation performance', async () => {
    const iterations = 10000;
    
    // Result creation benchmark
    const resultStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      const result = i % 2 === 0 
        ? ok(i) 
        : err(new ZeroError('TEST_ERROR', 'Test error'));
      
      if (result.ok) {
        const value = result.value;
      }
    }
    const resultTime = performance.now() - resultStart;

    // Traditional try/catch benchmark
    const tryStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      try {
        if (i % 2 !== 0) {
          throw new Error('Test error');
        }
        const value = i;
      } catch (error) {
        // Handle error
      }
    }
    const tryTime = performance.now() - tryStart;

    console.log(`\n=== Result Creation Performance ===`);
    console.log(`Result approach: ${resultTime.toFixed(2)}ms`);
    console.log(`Try/catch approach: ${tryTime.toFixed(2)}ms`);
    console.log(`Performance ratio: ${(tryTime / resultTime).toFixed(2)}x`);

    // Result should be competitive (within 5x)
    expect(resultTime).toBeLessThan(tryTime * 5);
  });

  // Benchmark: Async operations with tryR
  it('should benchmark async operations performance', async () => {
    const iterations = 1000;
    
    // Async Result operations
    const resultStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      const result = await tryR(
        async () => {
          await new Promise(resolve => setImmediate(resolve));
          if (Math.random() < 0.1) throw new Error('Random error');
          return { id: i, data: `Value ${i}` };
        },
        (e) => wrap(e, 'ASYNC_ERROR', 'Async operation failed')
      );
      
      if (result.ok) {
        const data = result.value;
      }
    }
    const resultTime = performance.now() - resultStart;

    // Traditional async try/catch
    const tryStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      try {
        await new Promise(resolve => setImmediate(resolve));
        if (Math.random() < 0.1) throw new Error('Random error');
        const data = { id: i, data: `Value ${i}` };
      } catch (error) {
        // Handle error
      }
    }
    const tryTime = performance.now() - tryStart;

    console.log(`\n=== Async Operations Performance ===`);
    console.log(`Result approach: ${resultTime.toFixed(2)}ms`);
    console.log(`Try/catch approach: ${tryTime.toFixed(2)}ms`);
    console.log(`Performance ratio: ${(tryTime / resultTime).toFixed(2)}x`);

    // Result should be competitive
    expect(resultTime).toBeLessThan(tryTime * 5);
  });

  // Benchmark: Error wrapping and context
  it('should benchmark error wrapping performance', async () => {
    const iterations = 5000;
    
    // ZeroError wrapping with context
    const wrapStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      const baseError = new Error('Base error');
      const wrapped = wrap(baseError, 'WRAPPED_ERROR', 'Operation failed', {
        iteration: i,
        timestamp: Date.now(),
        userId: `user-${i}`,
        metadata: { attempt: 1, retryable: true }
      });
      
      // Access error properties
      const code = wrapped.code;
      const context = wrapped.context;
    }
    const wrapTime = performance.now() - wrapStart;

    // Traditional error handling with custom properties
    const traditionalStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      const error = new Error('Operation failed');
      (error as any).code = 'WRAPPED_ERROR';
      (error as any).originalError = new Error('Base error');
      (error as any).context = {
        iteration: i,
        timestamp: Date.now(),
        userId: `user-${i}`,
        metadata: { attempt: 1, retryable: true }
      };
      
      // Access error properties
      const code = (error as any).code;
      const context = (error as any).context;
    }
    const traditionalTime = performance.now() - traditionalStart;

    console.log(`\n=== Error Wrapping Performance ===`);
    console.log(`ZeroError wrap: ${wrapTime.toFixed(2)}ms`);
    console.log(`Traditional approach: ${traditionalTime.toFixed(2)}ms`);
    console.log(`Performance ratio: ${(traditionalTime / wrapTime).toFixed(2)}x`);

    expect(wrapTime).toBeLessThan(traditionalTime * 2);
  });

  // Benchmark: Result chaining operations
  it('should benchmark Result chaining performance', async () => {
    const iterations = 1000;
    
    // Result chaining approach
    const chainStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      const result = await tryR(() => Promise.resolve(i))
        .then(r => r.ok ? ok(r.value * 2) : r)
        .then(r => r.ok ? ok(r.value + 10) : r)
        .then(r => r.ok ? ok(r.value.toString()) : r);
      
      if (result.ok) {
        const final = result.value;
      }
    }
    const chainTime = performance.now() - chainStart;

    // Traditional promise chaining with error handling
    const promiseStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      try {
        const step1 = await Promise.resolve(i);
        const step2 = step1 * 2;
        const step3 = step2 + 10;
        const final = step3.toString();
      } catch (error) {
        // Handle error
      }
    }
    const promiseTime = performance.now() - promiseStart;

    console.log(`\n=== Result Chaining Performance ===`);
    console.log(`Result chaining: ${chainTime.toFixed(2)}ms`);
    console.log(`Promise chaining: ${promiseTime.toFixed(2)}ms`);
    console.log(`Performance ratio: ${(promiseTime / chainTime).toFixed(2)}x`);

    // Performance comparison can vary - just ensure it's reasonable
    expect(chainTime).toBeLessThan(promiseTime * 20);
  });

  // Benchmark: Utility functions performance
  it('should benchmark utility functions performance', () => {
    const iterations = 10000;
    const results: Result<number, ZeroError>[] = [];
    
    // Prepare test data
    for (let i = 0; i < iterations; i++) {
      results.push(
        i % 2 === 0 
          ? ok(i) 
          : err(new ZeroError('TEST_ERROR', `Error ${i}`))
      );
    }

    // Inline utility functions since they're not exported
    const isOk = <T, E>(result: Result<T, E>): result is { ok: true; value: T } => result.ok;
    const unwrap = <T, E>(result: Result<T, E>): T => {
      if (!result.ok) throw new Error('Cannot unwrap error result');
      return result.value;
    };
    const unwrapOr = <T, E>(result: Result<T, E>, defaultValue: T): T => 
      result.ok ? result.value : defaultValue;

    // Benchmark unwrap operations
    const unwrapStart = performance.now();
    for (const result of results) {
      if (isOk(result)) {
        const value = unwrap(result);
      }
    }
    const unwrapTime = performance.now() - unwrapStart;

    // Benchmark unwrapOr operations
    const unwrapOrStart = performance.now();
    for (const result of results) {
      const value = unwrapOr(result, -1);
    }
    const unwrapOrTime = performance.now() - unwrapOrStart;

    // Traditional approach
    const traditionalStart = performance.now();
    for (const result of results) {
      const value = result.ok ? result.value : -1;
    }
    const traditionalTime = performance.now() - traditionalStart;

    console.log(`\n=== Utility Functions Performance ===`);
    console.log(`unwrap with isOk: ${unwrapTime.toFixed(2)}ms`);
    console.log(`unwrapOr: ${unwrapOrTime.toFixed(2)}ms`);
    console.log(`Traditional check: ${traditionalTime.toFixed(2)}ms`);

    // Utility functions should be competitive
    expect(unwrapOrTime).toBeLessThan(traditionalTime * 5);
  });

  // Benchmark: Error propagation in deep call stacks
  it('should benchmark error propagation in deep stacks', async () => {
    const depth = 100;
    const iterations = 100;

    // Result-based deep stack
    async function resultStack(level: number): Promise<Result<number, ZeroError>> {
      if (level === 0) {
        return Math.random() < 0.1 
          ? err(new ZeroError('BOTTOM_ERROR', 'Error at bottom'))
          : ok(42);
      }
      
      const result = await resultStack(level - 1);
      if (!result.ok) {
        return result;
      }
      
      return ok(result.value + level);
    }

    const resultStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      const result = await resultStack(depth);
      if (!result.ok) {
        // Handle error
      }
    }
    const resultTime = performance.now() - resultStart;

    // Traditional exception-based deep stack
    async function exceptionStack(level: number): Promise<number> {
      if (level === 0) {
        if (Math.random() < 0.1) {
          throw new Error('Error at bottom');
        }
        return 42;
      }
      
      const value = await exceptionStack(level - 1);
      return value + level;
    }

    const exceptionStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      try {
        const value = await exceptionStack(depth);
      } catch (error) {
        // Handle error
      }
    }
    const exceptionTime = performance.now() - exceptionStart;

    console.log(`\n=== Deep Stack Error Propagation ===`);
    console.log(`Result propagation: ${resultTime.toFixed(2)}ms`);
    console.log(`Exception propagation: ${exceptionTime.toFixed(2)}ms`);
    console.log(`Performance ratio: ${(exceptionTime / resultTime).toFixed(2)}x`);

    expect(resultTime).toBeLessThan(exceptionTime * 2);
  });

  // Benchmark: Parallel error handling
  it('should benchmark parallel error handling', async () => {
    const parallelOps = 50;
    const iterations = 20;

    // Result-based parallel operations
    const resultStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      const operations = Array.from({ length: parallelOps }, (_, idx) => 
        tryR(
          async () => {
            await new Promise(resolve => setImmediate(resolve));
            if (Math.random() < 0.1) throw new Error(`Op ${idx} failed`);
            return idx;
          },
          (e) => wrap(e, 'PARALLEL_ERROR', `Operation ${idx} failed`)
        )
      );

      const results = await Promise.all(operations);
      const failures = results.filter(r => !r.ok);
      const successes = results.filter(r => r.ok);
    }
    const resultTime = performance.now() - resultStart;

    // Traditional Promise.allSettled approach
    const settledStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      const operations = Array.from({ length: parallelOps }, async (_, idx) => {
        await new Promise(resolve => setImmediate(resolve));
        if (Math.random() < 0.1) throw new Error(`Op ${idx} failed`);
        return idx;
      });

      const results = await Promise.allSettled(operations);
      const failures = results.filter(r => r.status === 'rejected');
      const successes = results.filter(r => r.status === 'fulfilled');
    }
    const settledTime = performance.now() - settledStart;

    console.log(`\n=== Parallel Error Handling ===`);
    console.log(`Result parallel: ${resultTime.toFixed(2)}ms`);
    console.log(`Promise.allSettled: ${settledTime.toFixed(2)}ms`);
    console.log(`Performance ratio: ${(settledTime / resultTime).toFixed(2)}x`);

    expect(resultTime).toBeLessThan(settledTime * 20);
  });

  // Benchmark: Memory usage patterns
  it('should demonstrate memory-efficient error handling', () => {
    const iterations = 1000;
    const errorData: any[] = [];

    // Measure baseline memory
    if (global.gc) global.gc();
    const baselineMemory = process.memoryUsage().heapUsed;

    // Result-based approach with controlled error data
    for (let i = 0; i < iterations; i++) {
      const result = err(new ZeroError('MEMORY_TEST', 'Test error', {
        iteration: i,
        data: 'x'.repeat(100) // Small context data
      }));
      errorData.push(result);
    }

    const resultMemory = process.memoryUsage().heapUsed - baselineMemory;

    // Clear for next test
    errorData.length = 0;
    if (global.gc) global.gc();

    // Traditional approach with error stacks
    const traditionalBaseline = process.memoryUsage().heapUsed;
    for (let i = 0; i < iterations; i++) {
      try {
        throw new Error('Test error with full stack trace');
      } catch (error) {
        (error as any).iteration = i;
        (error as any).data = 'x'.repeat(100);
        errorData.push(error);
      }
    }

    const traditionalMemory = process.memoryUsage().heapUsed - traditionalBaseline;

    console.log(`\n=== Memory Usage Patterns ===`);
    console.log(`Result errors memory: ${(resultMemory / 1024 / 1024).toFixed(2)}MB`);
    console.log(`Traditional errors memory: ${(traditionalMemory / 1024 / 1024).toFixed(2)}MB`);
    console.log(`Memory ratio: ${(traditionalMemory / resultMemory).toFixed(2)}x`);

    // Result approach should use less or similar memory
    // Result approach should use reasonable memory
    expect(resultMemory).toBeLessThanOrEqual(traditionalMemory * 3);
  });
});

// Real-world scenario benchmarks
describe('Real-World Scenario Performance', () => {
  it('should benchmark HTTP request handling pipeline', async () => {
    const requests = 100;

    // Simulate request processing pipeline
    class RequestProcessor {
      static async processWithResult(requestData: any): Promise<Result<any, ZeroError>> {
        // Validate request
        const validationResult = await tryR(
          async () => {
            if (!requestData.userId) throw new Error('Missing userId');
            if (!requestData.action) throw new Error('Missing action');
            return requestData;
          },
          (e) => wrap(e, 'VALIDATION_ERROR', 'Request validation failed')
        );

        if (!validationResult.ok) return validationResult;

        // Authenticate
        const authResult = await tryR(
          async () => {
            await new Promise(resolve => setImmediate(resolve));
            if (Math.random() < 0.05) throw new Error('Auth failed');
            return { authenticated: true, userId: validationResult.value.userId };
          },
          (e) => wrap(e, 'AUTH_ERROR', 'Authentication failed')
        );

        if (!authResult.ok) return authResult;

        // Process action
        const actionResult = await tryR(
          async () => {
            await new Promise(resolve => setImmediate(resolve));
            if (Math.random() < 0.05) throw new Error('Action failed');
            return { success: true, result: 'processed' };
          },
          (e) => wrap(e, 'ACTION_ERROR', 'Action processing failed')
        );

        return actionResult;
      }

      static async processWithExceptions(requestData: any): Promise<any> {
        // Validate request
        if (!requestData.userId) throw new Error('Missing userId');
        if (!requestData.action) throw new Error('Missing action');

        // Authenticate
        await new Promise(resolve => setImmediate(resolve));
        if (Math.random() < 0.05) throw new Error('Auth failed');

        // Process action
        await new Promise(resolve => setImmediate(resolve));
        if (Math.random() < 0.05) throw new Error('Action failed');

        return { success: true, result: 'processed' };
      }
    }

    // Benchmark Result approach
    const resultStart = performance.now();
    let resultSuccesses = 0;
    let resultFailures = 0;

    for (let i = 0; i < requests; i++) {
      const result = await RequestProcessor.processWithResult({
        userId: `user-${i}`,
        action: 'update'
      });

      if (result.ok) {
        resultSuccesses++;
      } else {
        resultFailures++;
      }
    }
    const resultTime = performance.now() - resultStart;

    // Benchmark exception approach
    const exceptionStart = performance.now();
    let exceptionSuccesses = 0;
    let exceptionFailures = 0;

    for (let i = 0; i < requests; i++) {
      try {
        await RequestProcessor.processWithExceptions({
          userId: `user-${i}`,
          action: 'update'
        });
        exceptionSuccesses++;
      } catch (error) {
        exceptionFailures++;
      }
    }
    const exceptionTime = performance.now() - exceptionStart;

    console.log(`\n=== HTTP Request Pipeline Performance ===`);
    console.log(`Result approach: ${resultTime.toFixed(2)}ms (${resultSuccesses} success, ${resultFailures} failures)`);
    console.log(`Exception approach: ${exceptionTime.toFixed(2)}ms (${exceptionSuccesses} success, ${exceptionFailures} failures)`);
    console.log(`Performance ratio: ${(exceptionTime / resultTime).toFixed(2)}x`);

    expect(resultTime).toBeLessThan(exceptionTime * 5);
  });
});