import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  fetchWithRetry, 
  withTimeout, 
  processBatch, 
  CircuitBreaker,
  AsyncQueue
} from './async-patterns';
import { ok, err, ZeroError } from '@flyingrobots/zerothrow';

describe('Async Patterns', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchWithRetry', () => {
    it('should succeed on first attempt', async () => {
      const operation = vi.fn().mockResolvedValue(ok('success'));

      const result = await fetchWithRetry(operation, { maxRetries: 3 });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe('success');
      }
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      const operation = vi.fn()
        .mockResolvedValueOnce(err(new ZeroError('TEMP_ERROR', 'Temporary failure')))
        .mockResolvedValueOnce(err(new ZeroError('TEMP_ERROR', 'Temporary failure')))
        .mockResolvedValueOnce(ok('success'));

      const result = await fetchWithRetry(operation, { 
        maxRetries: 3,
        initialDelay: 10 // Speed up test
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe('success');
      }
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should stop retrying on validation errors', async () => {
      const operation = vi.fn()
        .mockResolvedValue(err(new ZeroError('VALIDATION_ERROR', 'Invalid input')));

      const result = await fetchWithRetry(operation, { 
        maxRetries: 3,
        shouldRetry: (error) => error.code !== 'VALIDATION_ERROR'
      });

      expect(result.ok).toBe(false);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should fail after max retries', async () => {
      const operation = vi.fn()
        .mockResolvedValue(err(new ZeroError('TEMP_ERROR', 'Persistent failure')));

      const result = await fetchWithRetry(operation, { 
        maxRetries: 2,
        initialDelay: 10
      });

      expect(result.ok).toBe(false);
      expect(operation).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe('withTimeout', () => {
    it('should complete operation within timeout', async () => {
      const operation = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return ok('completed');
      });

      const result = await withTimeout(operation, 100);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe('completed');
      }
    });

    it('should timeout when operation takes too long', async () => {
      const operation = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
        return ok('completed');
      });

      const result = await withTimeout(operation, 50);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('TIMEOUT');
        expect(result.error.message).toContain('50ms');
      }
    });
  });

  describe('processBatch', () => {
    it('should process all items successfully', async () => {
      const items = [1, 2, 3, 4, 5];
      const processor = vi.fn().mockImplementation(async (item: number) => {
        return ok(item * 2);
      });

      const result = await processBatch(items, processor, { concurrency: 2 });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual([2, 4, 6, 8, 10]);
      }
      expect(processor).toHaveBeenCalledTimes(5);
    });

    it('should handle partial failures', async () => {
      const items = [1, 2, 3, 4, 5];
      const processor = vi.fn().mockImplementation(async (item: number) => {
        if (item === 3) {
          return err(new ZeroError('PROCESS_ERROR', `Failed to process ${item}`));
        }
        return ok(item * 2);
      });

      const result = await processBatch(items, processor, { 
        concurrency: 2,
        stopOnError: false 
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toHaveLength(1);
        expect(result.error[0].message).toContain('Failed to process 3');
      }
    });

    it('should stop on first error when configured', async () => {
      const items = [1, 2, 3, 4, 5];
      let processedCount = 0;
      const processor = vi.fn().mockImplementation(async (item: number) => {
        processedCount++;
        if (item === 2) {
          return err(new ZeroError('PROCESS_ERROR', `Failed to process ${item}`));
        }
        return ok(item * 2);
      });

      const result = await processBatch(items, processor, { 
        concurrency: 1,
        stopOnError: true 
      });

      expect(result.ok).toBe(false);
      expect(processedCount).toBeLessThan(5); // Should stop early
    });
  });

  describe('CircuitBreaker', () => {
    it('should allow operations when circuit is closed', async () => {
      const operation = vi.fn().mockResolvedValue(ok('success'));
      const breaker = new CircuitBreaker(operation, { failureThreshold: 3 });

      const result = await breaker.execute();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe('success');
      }
      expect(breaker.getState().state).toBe('closed');
    });

    it('should open circuit after threshold failures', async () => {
      const operation = vi.fn().mockResolvedValue(
        err(new ZeroError('SERVICE_ERROR', 'Service unavailable'))
      );
      const breaker = new CircuitBreaker(operation, { 
        failureThreshold: 2,
        resetTimeout: 1000
      });

      // First two failures
      await breaker.execute();
      await breaker.execute();

      expect(breaker.getState().state).toBe('open');

      // Third attempt should be rejected immediately
      const result = await breaker.execute();
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('CIRCUIT_OPEN');
      }
      
      // Operation should not be called for the third attempt
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should reset circuit after successful operation', async () => {
      const operation = vi.fn()
        .mockResolvedValueOnce(err(new ZeroError('SERVICE_ERROR', 'Failed')))
        .mockResolvedValueOnce(err(new ZeroError('SERVICE_ERROR', 'Failed')))
        .mockResolvedValue(ok('success'));

      const breaker = new CircuitBreaker(operation, { 
        failureThreshold: 2,
        resetTimeout: 50
      });

      // Trigger failures to open circuit
      await breaker.execute();
      await breaker.execute();
      expect(breaker.getState().state).toBe('open');

      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 60));

      // Next operation should succeed and close circuit
      const result = await breaker.execute();
      expect(result.ok).toBe(true);
      expect(breaker.getState().state).toBe('closed');
      expect(breaker.getState().failures).toBe(0);
    });
  });

  describe('AsyncQueue', () => {
    it('should process items in order with concurrency 1', async () => {
      const processedOrder: number[] = [];
      const processor = vi.fn().mockImplementation(async (item: number) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        processedOrder.push(item);
        return ok(item * 2);
      });

      const queue = new AsyncQueue(processor, { concurrency: 1 });

      const promises = [
        queue.add(1),
        queue.add(2),
        queue.add(3)
      ];

      const results = await Promise.all(promises);

      expect(results.every(r => r.ok)).toBe(true);
      expect(processedOrder).toEqual([1, 2, 3]);
    });

    it('should handle processing errors', async () => {
      const processor = vi.fn().mockImplementation(async (item: number) => {
        if (item === 2) {
          return err(new ZeroError('PROCESS_ERROR', `Failed to process ${item}`));
        }
        return ok(item * 2);
      });

      const queue = new AsyncQueue(processor, { concurrency: 1 });

      const results = await Promise.all([
        queue.add(1),
        queue.add(2),
        queue.add(3)
      ]);

      expect(results[0].ok).toBe(true);
      expect(results[1].ok).toBe(false);
      expect(results[2].ok).toBe(true);

      if (!results[1].ok) {
        expect(results[1].error.message).toContain('Failed to process 2');
      }
    });

    it('should retry failed operations when configured', async () => {
      let attempt = 0;
      const processor = vi.fn().mockImplementation(async (item: number) => {
        attempt++;
        if (attempt <= 2) {
          return err(new ZeroError('TEMP_ERROR', 'Temporary failure'));
        }
        return ok(item * 2);
      });

      const queue = new AsyncQueue(processor, { 
        concurrency: 1,
        retries: 2
      });

      const result = await queue.add(1);

      expect(result.ok).toBe(true);
      expect(processor).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });
});