#!/usr/bin/env node --expose-gc

import { ok, err, tryR, wrap, ZeroError } from '../dist/index.js';
import { MemoryProfiler, MemoryLeakDetector } from './memory-profile.js';

async function main() {
  console.log('Starting memory profiling for zerothrow Result types...\n');

  const profiler = new MemoryProfiler();

  // Test 1: ok() allocations
  await profiler.profile('ok() - 100k allocations', 100000, () => {
    return ok(42);
  });

  // Test 2: err() allocations
  const testError = new Error('test');
  await profiler.profile('err() - 100k allocations', 100000, () => {
    return err(testError);
  });

  // Test 3: ZeroError allocations
  await profiler.profile('ZeroError creation - 10k', 10000, () => {
    return new ZeroError('TEST_ERR', 'Test error message');
  });

  // Test 4: tryR success path
  await profiler.profile('tryR success - 10k', 10000, async () => {
    return await tryR(() => 'success');
  });

  // Test 5: tryR failure path
  await profiler.profile('tryR failure - 10k', 10000, async () => {
    return await tryR(() => { throw new Error('failure'); });
  });

  // Test 6: wrap() allocations
  const baseError = new Error('base');
  await profiler.profile('wrap() - 10k', 10000, () => {
    return wrap(baseError, 'WRAPPED', 'Wrapped error', { userId: '123' });
  });

  // Test 7: Complex object in ok()
  await profiler.profile('ok() with complex object - 10k', 10000, () => {
    return ok({
      id: 1,
      name: 'test',
      data: [1, 2, 3, 4, 5],
      nested: { a: 1, b: 2, c: 3 }
    });
  });

  // Test 8: Memory leak detection for tryR
  console.log('\nChecking for memory leaks...');
  const leakDetector = new MemoryLeakDetector();
  
  leakDetector.start();
  
  // Run a loop that could potentially leak memory
  for (let i = 0; i < 1000; i++) {
    await tryR(async () => {
      if (Math.random() > 0.5) {
        throw new Error(`Error ${i}`);
      }
      return { data: Array(100).fill(i) };
    });
    
    // Small delay to let GC run
    if (i % 100 === 0) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }
  
  const leakResult = leakDetector.stop();
  
  console.log('\nMemory Leak Detection:');
  console.log(`Leak detected: ${leakResult.leaked}`);
  console.log(`Memory trend: ${leakResult.trend.toFixed(2)} bytes/sample`);
  console.log(`Samples collected: ${leakResult.samples.length}`);
  
  // Generate report
  console.log('\n' + profiler.generateReport());
}

// Run with error handling
main().catch(console.error);