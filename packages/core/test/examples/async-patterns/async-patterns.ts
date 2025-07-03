import { Result, ok, err, ZeroError, tryR } from '@flyingrobots/zerothrow';

// Comprehensive async/await patterns with ZeroThrow

// Pattern 1: Basic async operation with Result
export async function fetchUserData(userId: string): Promise<Result<any, ZeroError>> {
  return tryR(
    async () => {
      const response = await fetch(`/api/users/${userId}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json();
    },
    (error) => new ZeroError(
      'FETCH_USER_ERROR',
      'Failed to fetch user data',
      { userId, cause: error }
    )
  );
}

// Pattern 2: Sequential async operations with early termination
export async function processUserRegistration(
  email: string,
  password: string
): Promise<Result<{ userId: string; token: string }, ZeroError>> {
  // Step 1: Validate email
  const emailValidation = await validateEmailUniqueness(email);
  if (!emailValidation.ok) {
    return err(emailValidation.error);
  }

  // Step 2: Hash password
  const hashResult = await hashPassword(password);
  if (!hashResult.ok) {
    return err(hashResult.error);
  }

  // Step 3: Create user
  const createResult = await createUser(email, hashResult.value);
  if (!createResult.ok) {
    return err(createResult.error);
  }

  // Step 4: Generate token
  const tokenResult = await generateAuthToken(createResult.value.id);
  if (!tokenResult.ok) {
    return err(tokenResult.error);
  }

  return ok({
    userId: createResult.value.id,
    token: tokenResult.value
  });
}

// Pattern 3: Parallel async operations
export async function fetchUserProfile(userId: string): Promise<Result<{
  user: any;
  posts: any[];
  followers: any[];
}, ZeroError>> {
  // Execute all requests in parallel
  const [userResult, postsResult, followersResult] = await Promise.all([
    fetchUser(userId),
    fetchUserPosts(userId),
    fetchUserFollowers(userId)
  ]);

  // Check if all succeeded
  if (!userResult.ok) return err(userResult.error);
  if (!postsResult.ok) return err(postsResult.error);
  if (!followersResult.ok) return err(followersResult.error);

  return ok({
    user: userResult.value,
    posts: postsResult.value,
    followers: followersResult.value
  });
}

// Pattern 4: Parallel with partial success handling
export async function fetchDashboardData(userId: string): Promise<Result<{
  critical: { user: any; account: any };
  optional: { 
    notifications?: any[];
    recommendations?: any[];
  };
  errors: ZeroError[];
}, ZeroError>> {
  // Critical data - must succeed
  const [userResult, accountResult] = await Promise.all([
    fetchUser(userId),
    fetchAccountInfo(userId)
  ]);

  if (!userResult.ok || !accountResult.ok) {
    return err(new ZeroError(
      'CRITICAL_DATA_ERROR',
      'Failed to load critical dashboard data',
      { 
        userError: userResult.ok ? null : userResult.error,
        accountError: accountResult.ok ? null : accountResult.error
      }
    ));
  }

  // Optional data - can fail
  const [notificationsResult, recommendationsResult] = await Promise.all([
    fetchNotifications(userId),
    fetchRecommendations(userId)
  ]);

  const errors: ZeroError[] = [];
  const optional: any = {};

  if (notificationsResult.ok) {
    optional.notifications = notificationsResult.value;
  } else {
    errors.push(notificationsResult.error);
  }

  if (recommendationsResult.ok) {
    optional.recommendations = recommendationsResult.value;
  } else {
    errors.push(recommendationsResult.error);
  }

  return ok({
    critical: {
      user: userResult.value,
      account: accountResult.value
    },
    optional,
    errors
  });
}

// Pattern 5: Retry with exponential backoff
export async function fetchWithRetry<T>(
  operation: () => Promise<Result<T, ZeroError>>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    shouldRetry?: (error: ZeroError) => boolean;
  } = {}
): Promise<Result<T, ZeroError>> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    shouldRetry = (error) => error.code !== 'VALIDATION_ERROR'
  } = options;

  let lastError: ZeroError | null = null;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await operation();
    
    if (result.ok) {
      return result;
    }

    lastError = result.error;

    // Check if we should retry
    if (attempt === maxRetries || !shouldRetry(result.error)) {
      return err(result.error);
    }

    // Wait before retry
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // Exponential backoff
    delay = Math.min(delay * 2, maxDelay);
  }

  return err(lastError || new ZeroError('RETRY_EXHAUSTED', 'All retry attempts failed'));
}

// Pattern 6: Timeout wrapper
export async function withTimeout<T>(
  operation: () => Promise<Result<T, ZeroError>>,
  timeoutMs: number
): Promise<Result<T, ZeroError>> {
  const timeoutPromise = new Promise<Result<T, ZeroError>>((resolve) => {
    setTimeout(() => {
      resolve(err(new ZeroError(
        'TIMEOUT',
        `Operation timed out after ${timeoutMs}ms`,
        { timeoutMs }
      )));
    }, timeoutMs);
  });

  return Promise.race([operation(), timeoutPromise]);
}

// Pattern 7: Batch processing with concurrency control
export async function processBatch<T, R>(
  items: T[],
  processor: (item: T) => Promise<Result<R, ZeroError>>,
  options: {
    concurrency?: number;
    stopOnError?: boolean;
  } = {}
): Promise<Result<R[], ZeroError[]>> {
  const { concurrency = 5, stopOnError = false } = options;
  const results: R[] = [];
  const errors: ZeroError[] = [];

  // Process items in chunks
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency);
    const chunkPromises = chunk.map((item, index) => 
      processor(item).then(result => ({ result, index: i + index }))
    );

    const chunkResults = await Promise.all(chunkPromises);

    for (const { result, index } of chunkResults) {
      if (result.ok) {
        results[index] = result.value;
      } else {
        errors.push(result.error);
        if (stopOnError) {
          return err(errors);
        }
      }
    }
  }

  return errors.length > 0 ? err(errors) : ok(results);
}

// Pattern 8: Pipeline pattern - compose async operations
export function pipeline<T>(...operations: Array<(input: T) => Promise<Result<T, ZeroError>>>) {
  return async (initialValue: T): Promise<Result<T, ZeroError>> => {
    let current = initialValue;

    for (const operation of operations) {
      const result = await operation(current);
      if (!result.ok) {
        return result;
      }
      current = result.value;
    }

    return ok(current);
  };
}

// Pattern 9: Circuit breaker pattern
export class CircuitBreaker<T> {
  private failures = 0;
  private lastFailTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private operation: () => Promise<Result<T, ZeroError>>,
    private options: {
      failureThreshold?: number;
      resetTimeout?: number;
      testRequestInterval?: number;
    } = {}
  ) {}

  async execute(): Promise<Result<T, ZeroError>> {
    const {
      failureThreshold = 5,
      resetTimeout = 60000
    } = this.options;

    // Check if circuit is open
    if (this.state === 'open') {
      const timeSinceLastFail = Date.now() - this.lastFailTime;
      
      if (timeSinceLastFail < resetTimeout) {
        return err(new ZeroError(
          'CIRCUIT_OPEN',
          'Circuit breaker is open',
          { failures: this.failures, timeUntilReset: resetTimeout - timeSinceLastFail }
        ));
      }

      // Try half-open state
      this.state = 'half-open';
    }

    // Execute operation
    const result = await this.operation();

    if (result.ok) {
      // Success - reset circuit
      this.failures = 0;
      this.state = 'closed';
      return result;
    }

    // Failure - update state
    this.failures++;
    this.lastFailTime = Date.now();

    if (this.failures >= failureThreshold) {
      this.state = 'open';
    }

    return result;
  }

  getState() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailTime: this.lastFailTime
    };
  }
}

// Pattern 10: Async queue with Result handling
export class AsyncQueue<T, R> {
  private queue: Array<{ item: T; resolve: (result: Result<R, ZeroError>) => void }> = [];
  private processing = false;

  constructor(
    private processor: (item: T) => Promise<Result<R, ZeroError>>,
    private options: {
      concurrency?: number;
      retries?: number;
    } = {}
  ) {}

  async add(item: T): Promise<Result<R, ZeroError>> {
    return new Promise((resolve) => {
      this.queue.push({ item, resolve });
      this.process();
    });
  }

  private async process() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;
    const { concurrency = 1, retries = 0 } = this.options;

    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, concurrency);
      
      await Promise.all(
        batch.map(async ({ item, resolve }) => {
          let lastError: ZeroError | null = null;
          
          for (let attempt = 0; attempt <= retries; attempt++) {
            const result = await this.processor(item);
            
            if (result.ok) {
              resolve(result);
              return;
            }
            
            lastError = result.error;
          }
          
          resolve(err(lastError || new ZeroError('QUEUE_PROCESS_ERROR', 'Failed to process item')));
        })
      );
    }

    this.processing = false;
  }
}

// Helper functions (mock implementations)
async function validateEmailUniqueness(_email: string): Promise<Result<void, ZeroError>> {
  await new Promise(resolve => setTimeout(resolve, 100));
  return ok(undefined);
}

async function hashPassword(password: string): Promise<Result<string, ZeroError>> {
  await new Promise(resolve => setTimeout(resolve, 100));
  return ok(`hashed_${password}`);
}

async function createUser(_email: string, _passwordHash: string): Promise<Result<{ id: string }, ZeroError>> {
  await new Promise(resolve => setTimeout(resolve, 100));
  return ok({ id: `user_${Date.now()}` });
}

async function generateAuthToken(userId: string): Promise<Result<string, ZeroError>> {
  await new Promise(resolve => setTimeout(resolve, 100));
  return ok(`token_${userId}_${Date.now()}`);
}

async function fetchUser(userId: string): Promise<Result<any, ZeroError>> {
  await new Promise(resolve => setTimeout(resolve, 100));
  return ok({ id: userId, name: 'John Doe' });
}

async function fetchUserPosts(_userId: string): Promise<Result<any[], ZeroError>> {
  await new Promise(resolve => setTimeout(resolve, 150));
  return ok([{ id: 1, title: 'Post 1' }]);
}

async function fetchUserFollowers(_userId: string): Promise<Result<any[], ZeroError>> {
  await new Promise(resolve => setTimeout(resolve, 200));
  return ok([{ id: 2, name: 'Follower 1' }]);
}

async function fetchAccountInfo(_userId: string): Promise<Result<any, ZeroError>> {
  await new Promise(resolve => setTimeout(resolve, 100));
  return ok({ balance: 1000 });
}

async function fetchNotifications(_userId: string): Promise<Result<any[], ZeroError>> {
  await new Promise(resolve => setTimeout(resolve, 100));
  return ok([{ id: 1, message: 'New message' }]);
}

async function fetchRecommendations(userId: string): Promise<Result<any[], ZeroError>> {
  await new Promise(resolve => setTimeout(resolve, 100));
  // In real app, this would fetch from an API
  // For testing, use specific user IDs to control behavior
  if (userId === 'fail_user') {
    return err(new ZeroError('RECOMMENDATIONS_ERROR', 'Failed to fetch recommendations'));
  }
  return ok([{ id: 1, title: 'Recommended' }]);
}

// Example usage
export async function examples() {
  // Example 1: Sequential processing
  console.log('=== Sequential Processing ===');
  const regResult = await processUserRegistration('test@example.com', 'password123');
  if (regResult.ok) {
    console.log('Registration successful:', regResult.value);
  } else {
    console.error('Registration failed:', regResult.error);
  }

  // Example 2: Parallel processing
  console.log('\n=== Parallel Processing ===');
  const profileResult = await fetchUserProfile('user_123');
  if (profileResult.ok) {
    console.log('Profile loaded:', profileResult.value);
  }

  // Example 3: Retry with backoff - success case
  console.log('\n=== Retry Pattern - Success Case ===');
  const retrySuccessResult = await fetchWithRetry(
    async () => ok('Success on first try!'),
    { maxRetries: 3, initialDelay: 500 }
  );
  console.log('Retry success result:', retrySuccessResult);

  // Example 3b: Retry with backoff - failure case
  console.log('\n=== Retry Pattern - Failure Case ===');
  const retryFailResult = await fetchWithRetry(
    async () => err(new ZeroError('PERSISTENT_ERROR', 'Always fails')),
    { maxRetries: 2, initialDelay: 100 }
  );
  console.log('Retry fail result:', retryFailResult);

  // Example 4: Timeout
  console.log('\n=== Timeout Pattern ===');
  const timeoutResult = await withTimeout(
    async () => {
      await new Promise(resolve => setTimeout(resolve, 2000));
      return ok('Completed');
    },
    1000
  );
  console.log('Timeout result:', timeoutResult);

  // Example 5: Batch processing
  console.log('\n=== Batch Processing ===');
  const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const batchResult = await processBatch(
    items,
    async (item) => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return item % 3 === 0 
        ? err(new ZeroError('PROCESS_ERROR', `Failed to process ${item}`))
        : ok(item * 2);
    },
    { concurrency: 3 }
  );
  
  if (batchResult.ok) {
    console.log('Batch processed successfully:', batchResult.value);
  } else {
    console.log('Batch had errors:', batchResult.error);
  }

  // Example 6: Circuit breaker
  console.log('\n=== Circuit Breaker ===');
  let callCount = 0;
  const breaker = new CircuitBreaker(
    async () => {
      callCount++;
      if (callCount < 5) {
        return err(new ZeroError('SERVICE_ERROR', 'Service unavailable'));
      }
      return ok('Service recovered');
    },
    { failureThreshold: 3, resetTimeout: 1000 }
  );

  for (let i = 0; i < 7; i++) {
    const result = await breaker.execute();
    console.log(`Attempt ${i + 1}:`, result.ok ? 'Success' : result.error.code);
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  // Example 7: Async queue
  console.log('\n=== Async Queue ===');
  const queue = new AsyncQueue<number, number>(
    async (item) => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return ok(item * item);
    },
    { concurrency: 2 }
  );

  const queueResults = await Promise.all([
    queue.add(1),
    queue.add(2),
    queue.add(3),
    queue.add(4),
    queue.add(5)
  ]);

  console.log('Queue results:', queueResults.map(r => r.ok ? r.value : 'error'));
}