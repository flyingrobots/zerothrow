import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { tryR, wrap, err, ok, Result, ZeroError } from '../../src/index';

// Real-world API client integration test
interface User {
  id: string;
  name: string;
  email: string;
}

interface ApiResponse<T> {
  data: T;
  timestamp: number;
}

class ApiClient {
  private baseUrl: string;
  private maxRetries: number = 3;
  private retryDelay: number = 100; // Reduced for testing

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async fetchUser(userId: string): Promise<Result<User, ZeroError>> {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      const result = await this.attemptFetch(userId, attempt);
      
      if (result.ok) {
        return result;
      }

      const error = result.error;
      const isRetryable = this.isRetryableError(error);
      
      if (!isRetryable || attempt === this.maxRetries) {
        return err(wrap(
          error,
          'API_FETCH_FAILED',
          `Failed to fetch user after ${attempt} attempts`,
          {
            userId,
            attempts: attempt,
            lastError: error.code,
            timestamp: new Date().toISOString()
          }
        ));
      }

      await this.delay(this.retryDelay * attempt);
    }

    return err(new ZeroError('RETRY_EXHAUSTED', 'All retry attempts failed'));
  }

  private async attemptFetch(userId: string, attempt: number): Promise<Result<User, ZeroError>> {
    try {
      const response = await fetch(`${this.baseUrl}/users/${userId}`);
      
      if (!response.ok) {
        // Return HTTP error directly without wrapping as NETWORK_ERROR
        return err(new ZeroError('HTTP_ERROR', `HTTP ${response.status}: ${response.statusText}`, {
          status: response.status,
          statusText: response.statusText,
          userId,
          attempt
        }));
      }

      const data: ApiResponse<User> = await response.json();
      return ok(data.data);
    } catch (e) {
      // Only network/connection errors get wrapped as NETWORK_ERROR
      return err(wrap(e, 'NETWORK_ERROR', `Network error on attempt ${attempt}`, {
        userId,
        attempt,
        originalError: (e as Error).message
      }));
    }
  }

  private isRetryableError(error: ZeroError): boolean {
    // Only retry on specific network errors, not HTTP errors
    return error.code === 'NETWORK_ERROR' && !error.message.includes('HTTP');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

describe('API Retry Integration Tests', () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  const originalFetch = global.fetch;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should successfully fetch user on first attempt', async () => {
    const user = { id: 'user-123', name: 'John Doe', email: 'john@example.com' };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: user, timestamp: Date.now() })
    });

    const api = new ApiClient('https://api.example.com');
    const result = await api.fetchUser('user-123');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(user);
    }
  });

  it('should retry on network errors and eventually succeed', async () => {
    const user = { id: 'user-123', name: 'John Doe', email: 'john@example.com' };
    
    // Fail twice, then succeed
    mockFetch
      .mockRejectedValueOnce(new Error('Network timeout'))
      .mockRejectedValueOnce(new Error('Connection refused'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: user, timestamp: Date.now() })
      });

    const api = new ApiClient('https://api.example.com');
    const result = await api.fetchUser('user-123');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(user);
    }
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('should fail after max retries with detailed context', async () => {
    mockFetch.mockRejectedValue(new Error('Network timeout'));

    const api = new ApiClient('https://api.example.com');
    const result = await api.fetchUser('user-123');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('API_FETCH_FAILED');
      expect(result.error.context).toMatchObject({
        userId: 'user-123',
        attempts: 3,
        lastError: 'NETWORK_ERROR'
      });
    }
  });

  it('should not retry non-retryable errors', async () => {
    const api = new ApiClient('https://api.example.com');
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found'
    });

    const result = await api.fetchUser('user-404');

    expect(result.ok).toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(1); // No retries
  });
});

// Performance benchmark: Result vs try/catch
describe('Performance Benchmarks', () => {
  it('should demonstrate Result performance vs try/catch', async () => {
    const iterations = 1000;
    
    // Result-based approach
    const resultStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      const result = await tryR(() => {
        if (Math.random() < 0.1) throw new Error('Random error');
        return { success: true };
      });
      // Handle result without throwing
      if (!result.ok) {
        // Error handled
      }
    }
    const resultTime = performance.now() - resultStart;

    // Traditional try/catch approach
    const tryStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      try {
        if (Math.random() < 0.1) throw new Error('Random error');
        const data = { success: true };
        // Handle success
      } catch (error) {
        // Handle error
      }
    }
    const tryTime = performance.now() - tryStart;

    console.log(`Result approach: ${resultTime.toFixed(2)}ms`);
    console.log(`Try/catch approach: ${tryTime.toFixed(2)}ms`);
    console.log(`Result is ${(tryTime / resultTime).toFixed(1)}x faster`);

    // Result should be competitive
    expect(resultTime).toBeLessThan(tryTime * 5);
  });
});