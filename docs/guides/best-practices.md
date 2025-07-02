# Best Practices

Guidelines and recommendations for using ZeroThrow effectively.

## Table of Contents

- [Error Design](#error-design)
- [Function Signatures](#function-signatures)
- [Error Handling Patterns](#error-handling-patterns)
- [Testing Strategies](#testing-strategies)
- [Documentation Standards](#documentation-standards)
- [Common Pitfalls](#common-pitfalls)

## Error Design

### Use Meaningful Error Codes

```typescript
// ❌ Generic codes
return err(new ZeroError('ERROR', 'Something went wrong'));
return err(new ZeroError('FAIL', 'Operation failed'));

// ✅ Specific, actionable codes
return err(new ZeroError('USER_NOT_FOUND', 'User does not exist'));
return err(new ZeroError('INSUFFICIENT_BALANCE', 'Account balance too low'));
return err(new ZeroError('RATE_LIMIT_EXCEEDED', 'Too many requests'));
```

### Error Code Naming Convention

```typescript
// Domain-based prefixes
const ErrorCodes = {
  // Authentication
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
  AUTH_INSUFFICIENT_PERMISSIONS: 'AUTH_INSUFFICIENT_PERMISSIONS',
  
  // Validation
  VALIDATION_REQUIRED_FIELD: 'VALIDATION_REQUIRED_FIELD',
  VALIDATION_INVALID_FORMAT: 'VALIDATION_INVALID_FORMAT',
  VALIDATION_OUT_OF_RANGE: 'VALIDATION_OUT_OF_RANGE',
  
  // Business Logic
  ORDER_INSUFFICIENT_INVENTORY: 'ORDER_INSUFFICIENT_INVENTORY',
  ORDER_PAYMENT_DECLINED: 'ORDER_PAYMENT_DECLINED',
  ORDER_SHIPPING_UNAVAILABLE: 'ORDER_SHIPPING_UNAVAILABLE'
} as const;
```

### Include Helpful Context

```typescript
// ❌ Minimal context
return err(new ZeroError('VALIDATION_ERROR', 'Invalid input'));

// ✅ Rich context for debugging
return err(new ZeroError(
  'VALIDATION_ERROR',
  'Email format is invalid',
  undefined,
  {
    field: 'email',
    value: input.email,
    pattern: 'user@domain.com',
    received: typeof input.email
  }
));
```

## Function Signatures

### Be Explicit About Error Types

```typescript
// ❌ Generic error type
function processData(input: string): Result<Data, Error> {
  // ...
}

// ✅ Specific error types
type ProcessingError = 
  | ValidationError
  | ParseError
  | TransformError;

function processData(input: string): Result<Data, ProcessingError> {
  // ...
}
```

### Async Functions Always Return Results

```typescript
// ❌ Mixed return types
async function fetchUser(id: string): Promise<User | null> {
  try {
    return await api.getUser(id);
  } catch {
    return null;
  }
}

// ✅ Consistent Result return
async function fetchUser(id: string): Promise<Result<User, ApiError>> {
  return tryR(
    () => api.getUser(id),
    (error) => new ApiError('FETCH_USER_FAILED', error)
  );
}
```

### Document Result Types

```typescript
/**
 * Validates and processes user registration data.
 * 
 * @param input - Raw registration form data
 * @returns Success: Validated user data ready for storage
 * @returns Error: ValidationError with field-specific messages
 * 
 * @example
 * const result = await processRegistration({
 *   email: 'user@example.com',
 *   password: 'secure123',
 *   name: 'John Doe'
 * });
 */
async function processRegistration(
  input: RegistrationInput
): Promise<Result<ValidatedUser, ValidationError>> {
  // ...
}
```

## Error Handling Patterns

### Handle Errors at the Right Level

```typescript
// ❌ Swallowing errors too early
class UserService {
  async getUser(id: string): Promise<User | null> {
    const result = await this.repository.findById(id);
    return result.isOk ? result.value : null; // Lost error info!
  }
}

// ✅ Propagate errors to appropriate handler
class UserService {
  async getUser(id: string): Promise<Result<User, DatabaseError>> {
    return this.repository.findById(id);
  }
}

class UserController {
  async handleGetUser(req: Request, res: Response) {
    const result = await this.service.getUser(req.params.id);
    
    if (result.isErr) {
      // Handle error at controller level with full context
      this.handleError(result.error, res);
      return;
    }
    
    res.json(result.value);
  }
}
```

### Use Early Returns

```typescript
// ❌ Nested conditionals
function processRequest(req: Request): Result<Response, Error> {
  const authResult = authenticate(req);
  if (authResult.isOk) {
    const validationResult = validate(req.body);
    if (validationResult.isOk) {
      const processingResult = process(validationResult.value);
      if (processingResult.isOk) {
        return ok(createResponse(processingResult.value));
      } else {
        return processingResult;
      }
    } else {
      return validationResult;
    }
  } else {
    return authResult;
  }
}

// ✅ Early returns
function processRequest(req: Request): Result<Response, Error> {
  const authResult = authenticate(req);
  if (authResult.isErr) return authResult;
  
  const validationResult = validate(req.body);
  if (validationResult.isErr) return validationResult;
  
  const processingResult = process(validationResult.value);
  if (processingResult.isErr) return processingResult;
  
  return ok(createResponse(processingResult.value));
}
```

### Aggregate Related Errors

```typescript
// For operations that can have multiple errors
interface ValidationErrors {
  fields: Record<string, string[]>;
  hasErrors(): boolean;
}

function validateForm(data: FormData): Result<ValidData, ValidationErrors> {
  const errors: Record<string, string[]> = {};
  
  // Validate all fields
  if (!data.email) {
    errors.email = ['Email is required'];
  } else if (!isValidEmail(data.email)) {
    errors.email = ['Invalid email format'];
  }
  
  if (!data.password) {
    errors.password = ['Password is required'];
  } else if (data.password.length < 8) {
    errors.password = ['Password must be at least 8 characters'];
  }
  
  // Return aggregated errors
  if (Object.keys(errors).length > 0) {
    return err({
      fields: errors,
      hasErrors: () => true
    });
  }
  
  return ok(data as ValidData);
}
```

## Testing Strategies

### Test Both Success and Error Cases

```typescript
describe('UserService', () => {
  describe('createUser', () => {
    it('should create user successfully', async () => {
      const result = await service.createUser({
        email: 'valid@example.com',
        name: 'Test User'
      });
      
      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.email).toBe('valid@example.com');
      }
    });
    
    it('should return error for duplicate email', async () => {
      // Setup: create existing user
      await service.createUser({ email: 'existing@example.com', name: 'Existing' });
      
      // Test duplicate
      const result = await service.createUser({
        email: 'existing@example.com',
        name: 'Duplicate'
      });
      
      expect(result.isErr).toBe(true);
      if (result.isErr) {
        expect(result.error.code).toBe('USER_EXISTS');
        expect(result.error.context?.email).toBe('existing@example.com');
      }
    });
  });
});
```

### Test Error Recovery

```typescript
describe('Resilience', () => {
  it('should retry on transient failures', async () => {
    let attempts = 0;
    const operation = async () => {
      attempts++;
      if (attempts < 3) {
        return err(new Error('Transient failure'));
      }
      return ok('Success after retries');
    };
    
    const result = await retryWithBackoff(operation, 3);
    
    expect(result.isOk).toBe(true);
    expect(attempts).toBe(3);
  });
  
  it('should fall back to cache on API failure', async () => {
    const cache = { data: 'cached value' };
    const api = {
      fetch: async () => err(new Error('API down'))
    };
    
    const result = await fetchWithCache(api, cache);
    
    expect(result.isOk).toBe(true);
    expect(result.value).toBe('cached value');
  });
});
```

### Test Utilities

```typescript
// Test helpers for Results
export const expectOk = <T>(result: Result<T, any>): T => {
  expect(result.isOk).toBe(true);
  return (result as Ok<T>).value;
};

export const expectErr = <E>(result: Result<any, E>): E => {
  expect(result.isErr).toBe(true);
  return (result as Err<E>).error;
};

// Usage
it('should parse valid JSON', () => {
  const result = parseJson('{"key": "value"}');
  const data = expectOk(result);
  expect(data.key).toBe('value');
});

it('should handle invalid JSON', () => {
  const result = parseJson('invalid');
  const error = expectErr(result);
  expect(error.code).toBe('PARSE_ERROR');
});
```

## Documentation Standards

### Document Error Conditions

```typescript
/**
 * Transfers funds between accounts.
 * 
 * @param from - Source account ID
 * @param to - Destination account ID
 * @param amount - Amount to transfer (must be positive)
 * 
 * @returns Success: Transaction record with new balances
 * 
 * @errors
 * - `ACCOUNT_NOT_FOUND`: Source or destination account doesn't exist
 * - `INSUFFICIENT_FUNDS`: Source account has insufficient balance
 * - `INVALID_AMOUNT`: Amount is zero or negative
 * - `ACCOUNTS_SAME`: Source and destination are the same
 * - `ACCOUNT_FROZEN`: Either account is frozen
 * - `LIMIT_EXCEEDED`: Transfer exceeds daily limit
 */
async function transferFunds(
  from: string,
  to: string,
  amount: number
): Promise<Result<Transaction, TransferError>> {
  // ...
}
```

### Provide Examples

```typescript
/**
 * Parses and validates a configuration file.
 * 
 * @example Success case
 * ```typescript
 * const result = await loadConfig('./config.json');
 * if (result.isOk) {
 *   console.log('Port:', result.value.port);
 * }
 * ```
 * 
 * @example Error handling
 * ```typescript
 * const result = await loadConfig('./config.json');
 * if (result.isErr) {
 *   if (result.error.code === 'FILE_NOT_FOUND') {
 *     console.log('Using default config');
 *   }
 * }
 * ```
 */
```

## Common Pitfalls

### Don't Throw Inside Result Functions

```typescript
// ❌ Throwing defeats the purpose
function processData(input: string): Result<Data, Error> {
  if (!input) {
    throw new Error('Input required'); // Don't throw!
  }
  return ok(transform(input));
}

// ✅ Return errors
function processData(input: string): Result<Data, Error> {
  if (!input) {
    return err(new Error('Input required'));
  }
  return ok(transform(input));
}
```

### Don't Ignore Error Context

```typescript
// ❌ Lost context
catch (error) {
  return err(new Error('Operation failed'));
}

// ✅ Preserve context
catch (error) {
  return err(wrap(
    error,
    'OPERATION_FAILED',
    'Failed to complete operation',
    { input, timestamp: Date.now() }
  ));
}
```

### Don't Mix Paradigms

```typescript
// ❌ Inconsistent error handling
class Service {
  async getUser(id: string): Promise<User> { // throws
    // ...
  }
  
  async updateUser(id: string, data: any): Promise<Result<User, Error>> {
    // ...
  }
}

// ✅ Consistent Result usage
class Service {
  async getUser(id: string): Promise<Result<User, Error>> {
    // ...
  }
  
  async updateUser(id: string, data: any): Promise<Result<User, Error>> {
    // ...
  }
}
```

### Handle All Error Types

```typescript
// ❌ Assuming error type
const result = await fetchData();
if (result.isErr) {
  console.log(result.error.message); // Error might not have message!
}

// ✅ Type-safe error handling
const result = await fetchData();
if (result.isErr) {
  const message = result.error instanceof Error 
    ? result.error.message 
    : String(result.error);
  console.log(message);
}
```

## Summary

1. **Design clear, actionable errors** with meaningful codes and context
2. **Use consistent patterns** throughout your codebase
3. **Handle errors at appropriate levels** - don't swallow them too early
4. **Test both success and failure paths** thoroughly
5. **Document error conditions** clearly in your API
6. **Avoid mixing paradigms** - commit fully to Result-based handling

Following these practices will lead to more maintainable, debuggable, and reliable applications.