# @zerothrow/resilience

> **🧠 ZeroThrow Layers**  
> • **ZT** – primitives (`try`, `tryAsync`, `ok`, `err`)  
> • **Result** – combinators (`map`, `andThen`, `match`)  
> • **ZeroThrow** – utilities (`collect`, `enhanceAsync`)  
> • **@zerothrow/*** – ecosystem packages (resilience, jest, etc)

> **ZeroThrow Ecosystem** · [Packages ⇢](https://github.com/zerothrow/zerothrow/blob/main/ECOSYSTEM.md)

[![CI](https://github.com/zerothrow/zerothrow/actions/workflows/ci.yml/badge.svg)](https://github.com/zerothrow/zerothrow/actions)
![npm](https://img.shields.io/npm/v/@zerothrow/resilience)
![types](https://img.shields.io/npm/types/@zerothrow/resilience)
![ecosystem](https://img.shields.io/badge/zerothrow-ecosystem-blue)

<div align="center">
<img src="https://raw.githubusercontent.com/flyingrobots/image-dump/refs/heads/main/optimized/marketing/brand/zerothrow-resilience.webp" height="300" />
</div>

Production-grade resilience patterns for ZeroThrow: retry policies, circuit breakers, and timeouts with full Result<T,E> integration.

## 🚧 Coming Soon in v0.3.0

**New resilience features coming Q1 2025:**
- **Conditional Retry Logic** (#71) - `shouldRetry` predicates to skip retries for specific errors
- **Retry Progress Events** (#72) - Lifecycle callbacks for retry visibility and monitoring
- **Conditional Policies** (#53) - Context-aware policy selection for dynamic strategies
- **Bulkhead Policy** (#47) - Resource isolation and double-submit protection
- **Hedge Policy** (#48) - Latency optimization with parallel request hedging

See [ROADMAP.md](../../project/ROADMAP.md) for full details.

## What's New in v0.2.0 🎉

**Breaking Changes:**
- **Policy Hierarchy**: `Policy` is now the base type with specific subtypes:
  - `RetryPolicy` for retry operations
  - `CircuitBreakerPolicy` for circuit breaker patterns  
  - `TimeoutPolicy` for timeout handling
- **Factory Renamed**: `Policy` static methods are now on `PolicyFactory`
- **New Callbacks**: Added `onRetry` and `onCircuitStateChange` for better observability

```typescript
// Old (v0.1.x)
import { Policy } from '@zerothrow/resilience';
const retry = Policy.retry(3);

// New (v0.2.0)
import { PolicyFactory } from '@zerothrow/resilience';
const retry = PolicyFactory.retry(3);
```

## Installation

```bash
npm install @zerothrow/resilience @zerothrow/core
# or: pnpm add @zerothrow/resilience @zerothrow/core
```

## Quick Start

```typescript
import { PolicyFactory } from '@zerothrow/resilience';
import { ZT } from '@zerothrow/core';

// Create a resilient API call with retry, circuit breaker, and timeout
const resilientFetch = PolicyFactory.compose(
  PolicyFactory.retry(3, { backoff: 'exponential', delay: 1000 }),
  PolicyFactory.circuitBreaker({ threshold: 5, duration: 60000 }),
  PolicyFactory.timeout(5000)
);

const result = await resilientFetch.execute(async () => {
  const response = await fetch('https://api.example.com/data');
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
});

// Using combinators for elegant error handling
const processed = result
  .map(data => ({ ...data, timestamp: Date.now() }))
  .tap(data => console.log('Success:', data))
  .tapErr(error => console.error('Failed after retries:', error))
  .unwrapOr({ fallback: true });
```

## API

### Retry Policy

Automatically retry failed operations with configurable backoff strategies.

```typescript
// Basic retry - 3 attempts with constant 1s delay
const retry = PolicyFactory.retry(3);

// Exponential backoff: 1s, 2s, 4s, 8s...
const retryExp = PolicyFactory.retry(5, { 
  backoff: 'exponential',
  delay: 1000,      // Base delay
  maxDelay: 30000   // Cap at 30 seconds
});

// Linear backoff: 1s, 2s, 3s, 4s...
const retryLinear = PolicyFactory.retry(4, { 
  backoff: 'linear',
  delay: 1000 
});

// Selective retry - only retry specific errors
const retryNetwork = PolicyFactory.retry(3, {
  handle: (error) => error.message.includes('ECONNREFUSED')
});
```

#### Jitter Support

Jitter prevents thundering herd problems by randomizing retry delays. Multiple jitter strategies are available:

```typescript
// Full jitter: random delay between 0 and calculated delay
const retryFullJitter = PolicyFactory.retry(3, {
  delay: 1000,
  backoff: 'exponential',
  jitter: 'full'  // 0-1000ms, 0-2000ms, 0-4000ms...
});

// Equal jitter: delay between 50% and 100% of calculated delay  
const retryEqualJitter = PolicyFactory.retry(3, {
  delay: 1000,
  backoff: 'exponential', 
  jitter: 'equal'  // 500-1000ms, 1000-2000ms, 2000-4000ms...
});

// Decorrelated jitter: AWS-style jitter with state between attempts
const retryDecorrelated = PolicyFactory.retry(3, {
  delay: 1000,
  jitter: 'decorrelated'  // Stateful randomization
});

// Custom randomness for testing
const retryTestable = PolicyFactory.retry(3, {
  delay: 1000,
  jitter: {
    strategy: 'full',
    random: () => 0.5  // Deterministic for tests
  }
});
```

### Circuit Breaker Policy

Fail fast when a service is down to prevent cascading failures.

```typescript
// Open circuit after 5 failures, stay open for 60 seconds
const breaker = PolicyFactory.circuitBreaker({
  threshold: 5,        // Failures before opening
  duration: 60000,     // Stay open for 1 minute
  onOpen: () => console.log('Circuit opened!'),
  onClose: () => console.log('Circuit closed!')
});

// The circuit breaker has three states:
// - Closed: Normal operation, requests pass through
// - Open: All requests fail immediately with CircuitOpenError
// - Half-Open: After duration, one request is allowed to test recovery
```

### Timeout Policy

Prevent operations from hanging indefinitely.

```typescript
// Timeout after 5 seconds
const timeout = PolicyFactory.timeout(5000);

// Or with options object
const timeout = PolicyFactory.timeout({ timeout: 5000 });

// Operations that exceed the timeout will fail with TimeoutError
const result = await timeout.execute(async () => {
  await slowDatabaseQuery(); // Fails if > 5s
});
```

### Policy Composition

Combine multiple policies for defense in depth. Policies compose from left to right (leftmost is outermost).

```typescript
// Method 1: Using compose
const resilient = PolicyFactory.compose(
  PolicyFactory.retry(3, { backoff: 'exponential' }),
  PolicyFactory.circuitBreaker({ threshold: 5, duration: 60000 }),
  PolicyFactory.timeout(5000)
);

// Method 2: Using wrap (for two policies)
const retryWithTimeout = PolicyFactory.wrap(
  PolicyFactory.retry(3),
  PolicyFactory.timeout(5000)
);

// Execution order (for compose example):
// 1. Retry policy executes
// 2. For each retry attempt:
//    - Circuit breaker checks if open
//    - If closed, timeout policy executes
//    - If timeout succeeds, operation runs
```

### Error Types

All policies return typed errors that provide context about failures:

```typescript
import { 
  RetryExhaustedError, 
  CircuitOpenError, 
  TimeoutError 
} from '@zerothrow/resilience';

const result = await policy.execute(operation);

if (!result.ok) {
  if (result.error instanceof RetryExhaustedError) {
    console.log(`Failed after ${result.error.attempts} attempts`);
    console.log(`Last error: ${result.error.lastError.message}`);
  } else if (result.error instanceof CircuitOpenError) {
    console.log(`Circuit opened at ${result.error.openedAt}`);
    console.log(`Failure count: ${result.error.failureCount}`);
  } else if (result.error instanceof TimeoutError) {
    console.log(`Timed out after ${result.error.elapsed}ms`);
  }
}
```

## Examples

### Resilient HTTP Client

```typescript
import { PolicyFactory } from '@zerothrow/resilience';

// Create a reusable HTTP client with resilience
class ResilientHttpClient {
  private policy = PolicyFactory.compose(
    PolicyFactory.retry(3, { 
      backoff: 'exponential',
      handle: (error) => {
        // Only retry network and 5xx errors
        return error.code === 'ECONNREFUSED' || 
               (error.status >= 500 && error.status < 600);
      }
    }),
    PolicyFactory.circuitBreaker({ 
      threshold: 10, 
      duration: 30000 
    }),
    PolicyFactory.timeout(10000)
  );

  async get<T>(url: string): Promise<Result<T, Error>> {
    return this.policy.execute(async () => {
      const response = await fetch(url);
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`);
        (error as any).status = response.status;
        throw error;
      }
      return response.json() as T;
    });
  }
}
```

### Database Operations

```typescript
// Resilient database connection with retry and timeout
const dbPolicy = PolicyFactory.compose(
  PolicyFactory.retry(5, { 
    backoff: 'linear',
    delay: 500,
    handle: (error) => error.code === 'ECONNREFUSED'
  }),
  PolicyFactory.timeout(30000)
);

async function queryDatabase(sql: string) {
  const result = await dbPolicyFactory.execute(async () => {
    const conn = await getConnection();
    return conn.query(sql);
  });
  
  return result
    .tap(rows => logger.debug(`Query returned ${rows.length} rows`))
    .tapErr(error => logger.error('Database query failed', { sql, error }))
    .map(rows => rows.filter(row => row.active))
    .unwrapOr([]);
}
```

### Microservice Communication

```typescript
// Different policies for different service criticality
const criticalServicePolicy = PolicyFactory.compose(
  PolicyFactory.retry(5, { backoff: 'exponential', maxDelay: 10000 }),
  PolicyFactory.circuitBreaker({ threshold: 3, duration: 60000 }),
  PolicyFactory.timeout(5000)
);

const nonCriticalServicePolicy = PolicyFactory.compose(
  PolicyFactory.retry(1),  // Only one retry
  PolicyFactory.timeout(2000)  // Shorter timeout
);

// Use appropriate policy based on service with result chaining
async function callService(name: string, request: any) {
  const policy = name === 'payment' 
    ? criticalServicePolicy 
    : nonCriticalServicePolicy;
    
  return policy.execute(() => serviceClient.call(name, request))
    .then(result => result
      .tap(response => metrics.recordLatency(name, response.latency))
      .map(response => response.data)
      .mapErr(error => {
        telemetry.recordError(name, error);
        return new ServiceError(name, error);
      })
    );
}
```

### Testing with TestClock

```typescript
import { Policy, TestClock } from '@zerothrow/resilience';

// Use TestClock for deterministic tests
test('retry with exponential backoff', async () => {
  const clock = new TestClock();
  const retry = PolicyFactory.retry(3, { 
    backoff: 'exponential',
    delay: 1000 
  }, clock);
  
  let attempts = 0;
  const operation = jest.fn(async () => {
    attempts++;
    if (attempts < 3) throw new Error('Failed');
    return 'success';
  });
  
  const promise = retry.execute(operation);
  
  // First attempt fails immediately
  await clock.advance(0);
  expect(operation).toHaveBeenCalledTimes(1);
  
  // Second attempt after 1s
  await clock.advance(1000);
  expect(operation).toHaveBeenCalledTimes(2);
  
  // Third attempt after 2s (exponential)
  await clock.advance(2000);
  expect(operation).toHaveBeenCalledTimes(3);
  
  const result = await promise;
  expect(result.ok).toBe(true);
});
```

## Integration with ZeroThrow Core

All policies work seamlessly with ZeroThrow's Result type and combinators:

```typescript
import { ZT, Result, ZeroThrow } from '@zerothrow/core';
import { PolicyFactory } from '@zerothrow/resilience';

// Policies always return Result<T, Error>
const policy = PolicyFactory.retry(3);
const result: Result<Data, Error> = await policy.execute(fetchData);

// Chain multiple transformations
const processed = result
  .map(data => transform(data))
  .andThen(data => validate(data))
  .map(data => enrichData(data))
  .tap(data => logger.info('Processing complete', { data }))
  .tapErr(error => {
    if (error instanceof RetryExhaustedError) {
      metrics.increment('retry.exhausted');
    }
  })
  .orElse(error => {
    if (error instanceof RetryExhaustedError) {
      return ZT.ok(fallbackData);
    }
    return ZT.err(error);
  })
  .unwrapOr(defaultData);

// Use with ZT utilities and combinators
const results = await Promise.all(
  urls.map(url => 
    policy.execute(() => fetch(url).then(r => r.json()))
  )
);

// Process all results with combinators
const processed = ZeroThrow.collect(results)
  .map(dataArray => dataArray.filter(d => d.valid))
  .tap(valid => console.log(`Processed ${valid.length} valid items`))
  .unwrapOr([]);
```

## Contributing

See the [main repository](https://github.com/zerothrow/zerothrow) for contribution guidelines.

## License

MIT