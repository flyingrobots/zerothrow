import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ZT, ZeroThrow } from '../../src/index.js';
import http from 'http';
import { AddressInfo } from 'net';

// Real-world API client integration test with actual HTTP server
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

  async fetchUser(userId: string): Promise<ZeroThrow.Result<User, ZeroThrow.ZeroError>> {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      const result = await this.attemptFetch(userId, attempt);

      if (result.ok) {
        return result;
      }

      const error = result.error;
      const isRetryable = this.isRetryableError(error);

      if (!isRetryable || attempt === this.maxRetries) {
        return ZT.err(
          ZeroThrow.wrap(
            error,
            'API_FETCH_FAILED',
            `Failed to fetch user after ${attempt} attempts`,
            {
              userId,
              attempts: attempt,
              lastError: error.code,
              timestamp: new Date().toISOString(),
            }
          )
        );
      }

      await this.delay(this.retryDelay * attempt);
    }

    return ZT.err(new ZeroThrow.ZeroError('RETRY_EXHAUSTED', 'All retry attempts failed'));
  }

  private async attemptFetch(
    userId: string,
    attempt: number
  ): Promise<ZeroThrow.Result<User, ZeroThrow.ZeroError>> {
    try {
      const response = await fetch(`${this.baseUrl}/users/${userId}`);

      if (!response.ok) {
        // Return HTTP error directly without wrapping as NETWORK_ERROR
        return ZT.err(
          new ZeroThrow.ZeroError(
            'HTTP_ERROR',
            `HTTP ${response.status}: ${response.statusText}`,
            {
              status: response.status,
              statusText: response.statusText,
              userId,
              attempt,
            }
          )
        );
      }

      const data: ApiResponse<User> = await response.json();
      return ZT.ok(data.data);
    } catch (e) {
      // Only network/connection errors get wrapped as NETWORK_ERROR
      return ZT.err(
        ZeroThrow.wrap(e, 'NETWORK_ERROR', `Network error on attempt ${attempt}`, {
          userId,
          attempt,
          originalError: (e as Error).message,
        })
      );
    }
  }

  private isRetryableError(error: ZeroThrow.ZeroError): boolean {
    // Only retry on specific network errors, not HTTP errors
    return error.code === 'NETWORK_ERROR' && !error.message.includes('HTTP');
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

describe('API Retry Integration Tests', () => {
  let server: http.Server;
  let serverUrl: string;
  let requestCount = 0;
  let shouldFail = false;
  let failureCount = 0;

  beforeAll(async () => {
    // Create a real HTTP server for testing
    server = http.createServer((req, res) => {
      requestCount++;
      
      if (req.url?.startsWith('/users/')) {
        const userId = req.url.split('/')[2];
        
        // Simulate network failures for testing retry logic
        if (shouldFail && failureCount > 0) {
          failureCount--;
          // Abruptly close connection to simulate network error
          req.socket.destroy();
          return;
        }
        
        // Special handling for specific user IDs
        if (userId === 'user-404') {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'User not found' }));
          return;
        }
        
        // Success response
        const user = {
          id: userId,
          name: 'John Doe',
          email: 'john@example.com',
        };
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ data: user, timestamp: Date.now() }));
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    
    // Start server on random port
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const port = (server.address() as AddressInfo).port;
        serverUrl = `http://localhost:${port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    // Close the server
    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });

  it('should successfully fetch user on first attempt', async () => {
    requestCount = 0;
    shouldFail = false;
    
    const api = new ApiClient(serverUrl);
    const result = await api.fetchUser('user-123');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.id).toBe('user-123');
      expect(result.value.name).toBe('John Doe');
      expect(result.value.email).toBe('john@example.com');
    }
    expect(requestCount).toBe(1);
  });

  it('should retry on network errors and eventually succeed', async () => {
    requestCount = 0;
    shouldFail = true;
    failureCount = 2; // Fail first 2 attempts
    
    const api = new ApiClient(serverUrl);
    const result = await api.fetchUser('user-123');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.id).toBe('user-123');
      expect(result.value.name).toBe('John Doe');
    }
    expect(requestCount).toBe(3); // 2 failures + 1 success
  });

  it('should fail after max retries with detailed context', async () => {
    requestCount = 0;
    shouldFail = true;
    failureCount = 10; // Fail all attempts
    
    const api = new ApiClient(serverUrl);
    const result = await api.fetchUser('user-123');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('API_FETCH_FAILED');
      expect(result.error.context).toMatchObject({
        userId: 'user-123',
        attempts: 3,
        lastError: 'NETWORK_ERROR',
      });
    }
    expect(requestCount).toBe(3); // Max 3 retries
  });

  it('should not retry non-retryable errors', async () => {
    requestCount = 0;
    shouldFail = false;
    
    const api = new ApiClient(serverUrl);
    const result = await api.fetchUser('user-404');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('API_FETCH_FAILED');
      expect(result.error.cause?.code).toBe('HTTP_ERROR');
    }
    expect(requestCount).toBe(1); // No retries for 404
  });
});
