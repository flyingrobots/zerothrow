# Error Handling Strategies

Comprehensive guide to error handling patterns with ZeroThrow.

## Table of Contents

- [Error Design Principles](#error-design-principles)
- [Error Hierarchies](#error-hierarchies)
- [Context and Debugging](#context-and-debugging)
- [Error Boundaries](#error-boundaries)
- [Logging and Monitoring](#logging-and-monitoring)
- [User-Facing Errors](#user-facing-errors)
- [Testing Error Cases](#testing-error-cases)

## Error Design Principles

### 1. Make Errors Explicit

```typescript
import { Result, ZeroError } from '@flyingrobots/zerothrow';

// Bad: Error is implicit
function getUser(id: string): User | null {
  // Caller doesn't know why null was returned
  return null;
}

// Good: Error is explicit
function getUser(id: string): Result<User, ZeroError> {
  if (!isValidId(id)) {
    return err(new ZeroError('INVALID_ID', 'User ID format is invalid'));
  }
  
  const user = db.findUser(id);
  if (!user) {
    return err(new ZeroError('USER_NOT_FOUND', 'User does not exist'));
  }
  
  return ok(user);
}
```

### 2. Use Meaningful Error Codes

```typescript
// Define error codes as constants
export const ErrorCodes = {
  // Authentication errors
  AUTH_FAILED: 'AUTH_FAILED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  
  // Validation errors
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  INVALID_FORMAT: 'INVALID_FORMAT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  
  // Business logic errors
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  RESOURCE_LOCKED: 'RESOURCE_LOCKED',
  
  // System errors
  DATABASE_ERROR: 'DATABASE_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR'
} as const;

type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];
```

### 3. Include Actionable Information

```typescript
import { ZeroError, wrap } from '@flyingrobots/zerothrow';

// Bad: Generic error
return err(new Error('Operation failed'));

// Good: Specific, actionable error
return err(new ZeroError(
  'RATE_LIMIT_EXCEEDED',
  'API rate limit exceeded. Please retry after 60 seconds.',
  undefined,
  {
    limit: 100,
    window: '1h',
    retryAfter: 60,
    endpoint: '/api/users'
  }
));
```

## Error Hierarchies

Create structured error types for different domains:

```typescript
// Base domain error
abstract class DomainError extends ZeroError {
  abstract readonly domain: string;
  
  constructor(
    code: string,
    message: string,
    cause?: unknown,
    context?: Record<string, unknown>
  ) {
    super(code, message, cause, { ...context, domain: this.domain });
  }
}

// Specific domain errors
class ValidationError extends DomainError {
  readonly domain = 'validation';
  
  constructor(
    field: string,
    message: string,
    value?: unknown
  ) {
    super(
      'VALIDATION_ERROR',
      message,
      undefined,
      { field, value }
    );
  }
}

class AuthenticationError extends DomainError {
  readonly domain = 'auth';
  
  constructor(
    code: 'INVALID_CREDENTIALS' | 'TOKEN_EXPIRED' | 'NO_PERMISSION',
    message: string,
    context?: Record<string, unknown>
  ) {
    super(code, message, undefined, context);
  }
}

class BusinessError extends DomainError {
  readonly domain = 'business';
  
  constructor(
    code: string,
    message: string,
    context: Record<string, unknown>
  ) {
    super(code, message, undefined, context);
  }
}

// Usage
function withdrawFunds(
  account: Account,
  amount: number
): Result<Transaction, BusinessError> {
  if (account.balance < amount) {
    return err(new BusinessError(
      'INSUFFICIENT_FUNDS',
      'Not enough funds for withdrawal',
      {
        requested: amount,
        available: account.balance,
        accountId: account.id
      }
    ));
  }
  
  // Process withdrawal...
}
```

## Context and Debugging

### Error Context Patterns

```typescript
import { ZeroError, wrap } from '@flyingrobots/zerothrow';

// Layered context
class OperationContext {
  private context: Record<string, unknown> = {};
  
  add(key: string, value: unknown): this {
    this.context[key] = value;
    return this;
  }
  
  wrapError(error: unknown, code: string, message: string): ZeroError {
    return wrap(error, code, message, this.context);
  }
}

// Usage
async function processOrder(orderId: string): Promise<Result<Order, ZeroError>> {
  const context = new OperationContext()
    .add('orderId', orderId)
    .add('timestamp', new Date().toISOString())
    .add('service', 'order-processor');
  
  const orderResult = await fetchOrder(orderId);
  if (orderResult.isErr) {
    return err(context.wrapError(
      orderResult.error,
      'FETCH_ORDER_FAILED',
      'Failed to fetch order'
    ));
  }
  
  context.add('orderStatus', orderResult.value.status);
  
  const validationResult = validateOrder(orderResult.value);
  if (validationResult.isErr) {
    return err(context.wrapError(
      validationResult.error,
      'ORDER_VALIDATION_FAILED',
      'Order validation failed'
    ));
  }
  
  // Continue processing...
}
```

### Request Tracing

```typescript
// Add request ID to all errors in a request
interface RequestContext {
  requestId: string;
  userId?: string;
  correlationId?: string;
}

function createRequestError(
  error: unknown,
  code: string,
  message: string,
  requestContext: RequestContext,
  additionalContext?: Record<string, unknown>
): ZeroError {
  return wrap(error, code, message, {
    ...requestContext,
    ...additionalContext,
    timestamp: new Date().toISOString()
  });
}

// Middleware to add request context
app.use((req, res, next) => {
  req.context = {
    requestId: generateRequestId(),
    userId: req.user?.id,
    correlationId: req.headers['x-correlation-id']
  };
  next();
});
```

## Error Boundaries

### System Boundaries

```typescript
// Convert Results to exceptions at system boundaries
class ApiController {
  async getUser(req: Request, res: Response) {
    const result = await userService.getUser(req.params.id);
    
    if (result.isErr) {
      const error = result.error;
      
      // Map domain errors to HTTP responses
      switch (error.code) {
        case 'USER_NOT_FOUND':
          return res.status(404).json({
            error: error.message,
            code: error.code
          });
          
        case 'INVALID_ID':
          return res.status(400).json({
            error: error.message,
            code: error.code,
            field: 'id'
          });
          
        case 'DATABASE_ERROR':
          // Log internal error, return generic message
          logger.error('Database error', error);
          return res.status(500).json({
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
          });
          
        default:
          return res.status(500).json({
            error: 'An unexpected error occurred',
            code: 'UNKNOWN_ERROR'
          });
      }
    }
    
    res.json(result.value);
  }
}
```

### React Error Boundaries

```typescript
// Error boundary component
interface ErrorBoundaryState {
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = {
    error: null,
    errorInfo: null
  };
  
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to error reporting service
    errorReporter.logError(error, {
      componentStack: errorInfo.componentStack,
      ...this.props
    });
    
    this.setState({ error, errorInfo });
  }
  
  render() {
    if (this.state.error) {
      return <ErrorFallback error={this.state.error} />;
    }
    
    return this.props.children;
  }
}

// Use with Result-based components
function SafeComponent({ data }: { data: Result<Data, Error> }) {
  if (data.isErr) {
    // Throw to trigger error boundary
    throw data.error;
  }
  
  return <DataDisplay data={data.value} />;
}
```

## Logging and Monitoring

### Structured Logging

```typescript
interface Logger {
  error(message: string, error: ZeroError): void;
  warn(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
}

class StructuredLogger implements Logger {
  error(message: string, error: ZeroError): void {
    console.error(JSON.stringify({
      level: 'error',
      message,
      error: {
        code: error.code,
        message: error.message,
        context: error.context,
        stack: error.stack
      },
      timestamp: new Date().toISOString()
    }));
  }
  
  warn(message: string, context?: Record<string, unknown>): void {
    console.warn(JSON.stringify({
      level: 'warn',
      message,
      context,
      timestamp: new Date().toISOString()
    }));
  }
  
  info(message: string, context?: Record<string, unknown>): void {
    console.info(JSON.stringify({
      level: 'info',
      message,
      context,
      timestamp: new Date().toISOString()
    }));
  }
}

// Log errors with context
function logError(result: Result<any, ZeroError>, operation: string): void {
  if (result.isErr) {
    logger.error(`${operation} failed`, result.error);
    
    // Send to monitoring service
    monitoring.recordError({
      operation,
      errorCode: result.error.code,
      errorMessage: result.error.message,
      context: result.error.context
    });
  }
}
```

### Error Metrics

```typescript
class ErrorMetrics {
  private counters = new Map<string, number>();
  
  recordError(error: ZeroError): void {
    const key = `${error.code}:${error.context?.domain || 'unknown'}`;
    this.counters.set(key, (this.counters.get(key) || 0) + 1);
    
    // Send to metrics service
    metrics.increment('errors', {
      code: error.code,
      domain: error.context?.domain || 'unknown'
    });
  }
  
  getErrorRate(code: string, windowMs: number = 60000): number {
    // Calculate error rate for monitoring alerts
    // Implementation depends on metrics backend
  }
}
```

## User-Facing Errors

### Error Message Localization

```typescript
interface LocalizedError {
  code: string;
  message: string;
  userMessage: string;
  details?: Record<string, unknown>;
}

class ErrorLocalizer {
  constructor(private translations: Record<string, Record<string, string>>) {}
  
  localize(error: ZeroError, locale: string): LocalizedError {
    const key = error.code;
    const userMessage = this.translations[locale]?.[key] || 
                       this.translations['en'][key] || 
                       'An error occurred';
    
    return {
      code: error.code,
      message: error.message,
      userMessage,
      details: error.context
    };
  }
}

// Usage
const localizer = new ErrorLocalizer({
  en: {
    INVALID_EMAIL: 'Please enter a valid email address',
    PASSWORD_TOO_SHORT: 'Password must be at least 8 characters',
    USER_NOT_FOUND: 'User not found'
  },
  es: {
    INVALID_EMAIL: 'Por favor ingrese un email válido',
    PASSWORD_TOO_SHORT: 'La contraseña debe tener al menos 8 caracteres',
    USER_NOT_FOUND: 'Usuario no encontrado'
  }
});
```

### Error Recovery UI

```typescript
// React component with error recovery
function DataView() {
  const { data, error, loading, refetch } = useResult(
    () => fetchData(),
    []
  );
  
  if (error) {
    return (
      <ErrorDisplay
        error={error}
        onRetry={refetch}
        actions={getErrorActions(error)}
      />
    );
  }
  
  // ...
}

function getErrorActions(error: ZeroError): ErrorAction[] {
  switch (error.code) {
    case 'NETWORK_ERROR':
      return [
        { label: 'Retry', action: 'retry' },
        { label: 'Use Offline Mode', action: 'offline' }
      ];
      
    case 'AUTH_EXPIRED':
      return [
        { label: 'Login Again', action: 'login' },
        { label: 'Continue as Guest', action: 'guest' }
      ];
      
    default:
      return [{ label: 'Try Again', action: 'retry' }];
  }
}
```

## Testing Error Cases

### Unit Testing Errors

```typescript
import { describe, it, expect } from 'vitest';

describe('User Service', () => {
  it('should return error for invalid email', async () => {
    const result = await createUser('invalid-email', 'John');
    
    expect(result.isErr).toBe(true);
    expect(result.error.code).toBe('INVALID_EMAIL');
    expect(result.error.context).toMatchObject({
      field: 'email',
      value: 'invalid-email'
    });
  });
  
  it('should handle database errors', async () => {
    // Mock database to throw
    mockDb.save.mockRejectedValue(new Error('Connection lost'));
    
    const result = await createUser('john@example.com', 'John');
    
    expect(result.isErr).toBe(true);
    expect(result.error.code).toBe('DATABASE_ERROR');
    expect(result.error.cause).toBeInstanceOf(Error);
  });
});
```

### Integration Testing

```typescript
describe('API Error Handling', () => {
  it('should return 404 for non-existent user', async () => {
    const response = await request(app)
      .get('/api/users/non-existent')
      .expect(404);
    
    expect(response.body).toMatchObject({
      error: 'User not found',
      code: 'USER_NOT_FOUND'
    });
  });
  
  it('should handle validation errors', async () => {
    const response = await request(app)
      .post('/api/users')
      .send({ email: 'invalid' })
      .expect(400);
    
    expect(response.body).toMatchObject({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      errors: [
        { field: 'email', message: 'Invalid email format' }
      ]
    });
  });
});
```

## Next Steps

- Master [functional programming with Results](./04-functional-programming.md)
- Learn [testing strategies](./05-testing.md)
- Explore [performance optimization](../guides/performance.md)
- See [real-world examples](../examples/)