# ZeroThrow Best Practices

This guide covers best practices and patterns for using ZeroThrow effectively in your TypeScript projects.

## Core Principles

### 1. Never Throw Exceptions in User Code

```typescript
// ❌ Bad - throws exception
async function getUser(id: string): Promise<User> {
  const user = await db.findUser(id);
  if (!user) {
    throw new Error('User not found');
  }
  return user;
}

// ✅ Good - returns Result
async function getUser(id: string): Promise<Result<User, ZeroError>> {
  const user = await db.findUser(id);
  if (!user) {
    return err(new ZeroError('USER_NOT_FOUND', 'User not found', { userId: id }));
  }
  return ok(user);
}
```

### 2. Use Meaningful Error Codes

Error codes should be:
- Machine-readable constants
- Descriptive and specific
- Consistent across your application

```typescript
// ✅ Good error codes
const ErrorCodes = {
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_EXISTS',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  DATABASE_CONNECTION_ERROR: 'DATABASE_CONNECTION_ERROR'
} as const;

// Use them consistently
return err(new ZeroError(
  ErrorCodes.USER_NOT_FOUND,
  'User not found',
  { userId }
));
```

### 3. Always Check Result Status

```typescript
// ❌ Bad - assumes success
const userResult = await getUser(userId);
console.log(userResult.value.name); // Runtime error if result is Err

// ✅ Good - checks status
const userResult = await getUser(userId);
if (!userResult.ok) {
  // Handle error
  return err(userResult.error);
}
// TypeScript knows userResult.value exists here
console.log(userResult.value.name);
```

### 4. Use tryR for External Libraries

When working with libraries that throw exceptions, wrap them with `tryR`:

```typescript
import { parseJSON } from 'some-library';

// ✅ Good - converts throwing function to Result
const parseResult = await tryR(
  () => parseJSON(jsonString),
  (error) => new ZeroError(
    'JSON_PARSE_ERROR',
    'Failed to parse JSON',
    { input: jsonString, cause: error }
  )
);
```

### 5. Provide Meaningful Context

Always include relevant context in your errors:

```typescript
// ❌ Bad - no context
return err(new ZeroError('VALIDATION_ERROR', 'Validation failed'));

// ✅ Good - includes context
return err(new ZeroError(
  'VALIDATION_ERROR',
  'Email validation failed',
  { 
    field: 'email',
    value: email,
    reason: 'Invalid format',
    pattern: emailRegex.toString()
  }
));
```

## Common Patterns

### Early Return Pattern

Exit early when encountering errors:

```typescript
async function createOrder(data: OrderData): Promise<Result<Order, ZeroError>> {
  // Validate inventory
  const inventoryResult = await checkInventory(data.items);
  if (!inventoryResult.ok) {
    return err(inventoryResult.error);
  }

  // Calculate pricing
  const pricingResult = await calculatePricing(data);
  if (!pricingResult.ok) {
    return err(pricingResult.error);
  }

  // Process payment
  const paymentResult = await processPayment(pricingResult.value);
  if (!paymentResult.ok) {
    return err(paymentResult.error);
  }

  // Create order
  return createOrderRecord(data, paymentResult.value);
}
```

### Result Chaining

Chain operations that return Results:

```typescript
function processData(input: string): Result<ProcessedData, ZeroError> {
  const parseResult = parseInput(input);
  if (!parseResult.ok) return parseResult;

  const validateResult = validateData(parseResult.value);
  if (!validateResult.ok) return validateResult;

  const transformResult = transformData(validateResult.value);
  if (!transformResult.ok) return transformResult;

  return ok(transformResult.value);
}
```

### Collecting Multiple Errors

When you need to validate multiple fields:

```typescript
function validateForm(data: FormData): Result<ValidatedData, ZeroError[]> {
  const errors: ZeroError[] = [];

  const nameResult = validateName(data.name);
  if (!nameResult.ok) errors.push(nameResult.error);

  const emailResult = validateEmail(data.email);
  if (!emailResult.ok) errors.push(emailResult.error);

  const passwordResult = validatePassword(data.password);
  if (!passwordResult.ok) errors.push(passwordResult.error);

  if (errors.length > 0) {
    return err(errors);
  }

  return ok({
    name: nameResult.value,
    email: emailResult.value,
    password: passwordResult.value
  });
}
```

### Async Parallel Operations

Handle multiple async operations efficiently:

```typescript
async function loadDashboard(userId: string): Promise<Result<Dashboard, ZeroError>> {
  const results = await Promise.all([
    getUserProfile(userId),
    getUserStats(userId),
    getUserNotifications(userId)
  ]);

  const errors = results.filter(r => !r.ok).map(r => r.error);
  if (errors.length > 0) {
    return err(new ZeroError(
      'DASHBOARD_LOAD_ERROR',
      'Failed to load dashboard data',
      { errors }
    ));
  }

  // TypeScript can't infer all are Ok, so we need to assert
  const [profile, stats, notifications] = results as [
    Ok<UserProfile>,
    Ok<UserStats>,
    Ok<Notification[]>
  ];

  return ok({
    profile: profile.value,
    stats: stats.value,
    notifications: notifications.value
  });
}
```

## Error Handling Strategies

### 1. Layer-Specific Error Transformation

Transform errors at layer boundaries:

```typescript
// Repository layer
class UserRepository {
  async findById(id: string): Promise<Result<User, ZeroError>> {
    return tryR(
      () => db.query('SELECT * FROM users WHERE id = ?', [id]),
      (error) => new ZeroError(
        'DB_QUERY_ERROR',
        'Database query failed',
        { query: 'findById', id, cause: error }
      )
    );
  }
}

// Service layer
class UserService {
  async getUser(id: string): Promise<Result<UserDto, ZeroError>> {
    const result = await this.repo.findById(id);
    
    if (!result.ok) {
      // Transform database error to service-level error
      return err(new ZeroError(
        'USER_SERVICE_ERROR',
        'Failed to retrieve user',
        { userId: id, cause: result.error }
      ));
    }

    if (!result.value) {
      return err(new ZeroError(
        'USER_NOT_FOUND',
        'User does not exist',
        { userId: id }
      ));
    }

    return ok(this.mapToDto(result.value));
  }
}
```

### 2. Error Recovery

Implement fallback strategies:

```typescript
async function getConfigWithFallback(): Promise<Result<Config, ZeroError>> {
  // Try primary source
  const primaryResult = await fetchConfigFromAPI();
  if (primaryResult.ok) {
    return primaryResult;
  }

  // Try cache
  const cacheResult = await fetchConfigFromCache();
  if (cacheResult.ok) {
    return cacheResult;
  }

  // Use defaults
  return ok(getDefaultConfig());
}
```

### 3. Partial Success Handling

Handle operations where some failures are acceptable:

```typescript
async function sendNotifications(
  userIds: string[]
): Promise<Result<NotificationReport, never>> {
  const results = await Promise.all(
    userIds.map(id => sendNotification(id))
  );

  const successful = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);

  return ok({
    total: userIds.length,
    successful,
    failed: failed.length,
    errors: failed.map(r => ({
      userId: r.error.context?.userId,
      error: r.error.message
    }))
  });
}
```

## Testing with ZeroThrow

### Unit Testing

```typescript
import { describe, it, expect } from 'vitest';

describe('UserService', () => {
  it('should return error when user not found', async () => {
    const service = new UserService(mockRepo);
    const result = await service.getUser('invalid-id');
    
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('USER_NOT_FOUND');
      expect(result.error.context?.userId).toBe('invalid-id');
    }
  });

  it('should return user when found', async () => {
    const service = new UserService(mockRepo);
    const result = await service.getUser('valid-id');
    
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.id).toBe('valid-id');
    }
  });
});
```

### Testing Error Scenarios

```typescript
it('should handle database errors', async () => {
  const mockRepo = {
    findById: async () => err(new ZeroError(
      'DB_CONNECTION_ERROR',
      'Connection lost'
    ))
  };

  const service = new UserService(mockRepo);
  const result = await service.getUser('any-id');
  
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error.code).toBe('USER_SERVICE_ERROR');
    expect(result.error.cause?.code).toBe('DB_CONNECTION_ERROR');
  }
});
```

## Integration with Frameworks

### Express Middleware

```typescript
export function resultHandler(
  handler: (req: Request, res: Response) => Promise<Result<any, ZeroError>>
): RequestHandler {
  return async (req, res, next) => {
    try {
      const result = await handler(req, res);
      
      if (result.ok) {
        res.json({ success: true, data: result.value });
      } else {
        const statusCode = mapErrorToStatus(result.error.code);
        res.status(statusCode).json({
          success: false,
          error: {
            code: result.error.code,
            message: result.error.message
          }
        });
      }
    } catch (error) {
      // Fallback for unexpected errors
      next(error);
    }
  };
}

// Usage
app.get('/users/:id', resultHandler(async (req) => {
  return userService.getUser(req.params.id);
}));
```

### React Error Boundaries

```typescript
export function ResultBoundary({ 
  children, 
  fallback 
}: { 
  children: ReactNode;
  fallback: (error: ZeroError) => ReactNode;
}) {
  return (
    <ErrorBoundary
      fallbackRender={({ error }) => {
        const zeroError = error instanceof ZeroError 
          ? error 
          : new ZeroError('RENDER_ERROR', error.message);
        return <>{fallback(zeroError)}</>;
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
```

## Performance Considerations

1. **Avoid Creating Unnecessary Result Objects**: For internal functions that can't fail, use regular return types.

2. **Use Type Guards Efficiently**:
   ```typescript
   // Create a type guard
   function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
     return result.ok;
   }

   // Use it
   const results = await Promise.all(operations);
   const successful = results.filter(isOk);
   ```

3. **Minimize Context Data**: Only include necessary debugging information in error context.

## Migration Strategy

When migrating existing code to ZeroThrow:

1. Start with leaf functions (those that don't call other functions)
2. Work your way up the call stack
3. Use `tryR` to wrap existing throwing code
4. Gradually replace throws with Result returns
5. Enable the ESLint no-throw rule per file as you migrate

```typescript
// Step 1: Wrap existing function
const oldResult = await tryR(
  () => existingThrowingFunction(args),
  (error) => new ZeroError('LEGACY_ERROR', 'Legacy function failed', { cause: error })
);

// Step 2: Eventually rewrite the function to return Result natively
```

## Common Pitfalls

1. **Forgetting to Check Result Status**: Always check `.ok` before accessing `.value` or `.error`.

2. **Losing Error Context**: Always wrap errors with additional context when re-throwing.

3. **Mixing Patterns**: Don't mix throwing and Result patterns in the same codebase section.

4. **Over-Engineering**: Not every function needs to return a Result. Use it for operations that can fail.

5. **Type Assertion Abuse**: Avoid asserting Result types unless you're certain of the outcome.

## Conclusion

ZeroThrow provides a robust foundation for error handling in TypeScript applications. By following these best practices, you can build more reliable and maintainable software with clear error handling paths and excellent debugging capabilities.