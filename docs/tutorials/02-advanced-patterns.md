# Advanced Patterns with ZeroThrow

Master advanced error handling patterns and techniques.

## Table of Contents

- [Railway-Oriented Programming](#railway-oriented-programming)
- [Error Recovery Strategies](#error-recovery-strategies)
- [Validation Pipelines](#validation-pipelines)
- [Parallel Operations](#parallel-operations)
- [Error Aggregation](#error-aggregation)
- [State Machines](#state-machines)
- [Dependency Injection](#dependency-injection)

## Railway-Oriented Programming

Think of your code as a railway with two tracks: success and error.

```typescript
import { Result, ok, err, andThen, map } from '@flyingrobots/zerothrow';

// Each function returns a Result, keeping us on the tracks
type UserId = string & { __brand: 'UserId' };
type Email = string & { __brand: 'Email' };

function parseUserId(input: string): Result<UserId, string> {
  if (!input || input.length < 5) {
    return err('Invalid user ID format');
  }
  return ok(input as UserId);
}

function parseEmail(input: string): Result<Email, string> {
  if (!input.includes('@')) {
    return err('Invalid email format');
  }
  return ok(input as Email);
}

function createUserAccount(
  userId: UserId, 
  email: Email
): Result<User, string> {
  // Simulated user creation
  return ok({ id: userId, email });
}

// Compose the railway
function registerUser(
  userIdInput: string,
  emailInput: string
): Result<User, string> {
  const userIdResult = parseUserId(userIdInput);
  if (userIdResult.isErr) return userIdResult;

  const emailResult = parseEmail(emailInput);
  if (emailResult.isErr) return emailResult;

  return createUserAccount(userIdResult.value, emailResult.value);
}

// Or using combinators for cleaner code
function registerUserClean(
  userIdInput: string,
  emailInput: string
): Result<User, string> {
  return andThen(
    parseUserId(userIdInput),
    (userId) => andThen(
      parseEmail(emailInput),
      (email) => createUserAccount(userId, email)
    )
  );
}
```

## Error Recovery Strategies

### Fallback Values

```typescript
import { orElse, unwrapOr } from '@flyingrobots/zerothrow';

// Provide fallback for errors
function loadUserPreferences(userId: string): Result<Preferences, Error> {
  // Attempt to load from database
  return err(new Error('Database unavailable'));
}

function getDefaultPreferences(): Result<Preferences, never> {
  return ok({
    theme: 'light',
    language: 'en',
    notifications: true
  });
}

// Try primary, fall back to default
const preferences = orElse(
  loadUserPreferences('user123'),
  () => getDefaultPreferences()
);

// Or use unwrapOr for simple defaults
const theme = unwrapOr(
  map(preferences, p => p.theme),
  'light'
);
```

### Retry Logic

```typescript
import { Result, tryR } from '@flyingrobots/zerothrow';

async function withRetry<T>(
  operation: () => Promise<Result<T, Error>>,
  maxAttempts: number = 3,
  delay: number = 1000
): Promise<Result<T, Error>> {
  let lastError: Error | undefined;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await operation();
    
    if (result.isOk) {
      return result;
    }
    
    lastError = result.error;
    
    if (attempt < maxAttempts) {
      console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2; // Exponential backoff
    }
  }
  
  return err(lastError || new Error('All retry attempts failed'));
}

// Usage
const data = await withRetry(
  () => tryR(() => fetch('/api/data').then(r => r.json())),
  3,
  1000
);
```

### Circuit Breaker

```typescript
class CircuitBreaker<T> {
  private failures = 0;
  private lastFailTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  constructor(
    private threshold: number = 5,
    private timeout: number = 60000
  ) {}
  
  async execute(
    operation: () => Promise<Result<T, Error>>
  ): Promise<Result<T, Error>> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailTime > this.timeout) {
        this.state = 'half-open';
      } else {
        return err(new Error('Circuit breaker is open'));
      }
    }
    
    const result = await operation();
    
    if (result.isOk) {
      this.failures = 0;
      this.state = 'closed';
      return result;
    }
    
    this.failures++;
    this.lastFailTime = Date.now();
    
    if (this.failures >= this.threshold) {
      this.state = 'open';
    }
    
    return result;
  }
}

// Usage
const breaker = new CircuitBreaker<UserData>(5, 60000);
const result = await breaker.execute(() => fetchUserData(userId));
```

## Validation Pipelines

Build composable validation pipelines:

```typescript
import { Result, ok, err, andThen, collect } from '@flyingrobots/zerothrow';

// Validation function type
type Validator<T> = (value: T) => Result<T, string>;

// Combine multiple validators
function combine<T>(...validators: Validator<T>[]): Validator<T> {
  return (value: T) => {
    for (const validate of validators) {
      const result = validate(value);
      if (result.isErr) return result;
    }
    return ok(value);
  };
}

// String validators
const minLength = (min: number): Validator<string> =>
  (value) => value.length >= min 
    ? ok(value) 
    : err(`Must be at least ${min} characters`);

const maxLength = (max: number): Validator<string> =>
  (value) => value.length <= max 
    ? ok(value) 
    : err(`Must be at most ${max} characters`);

const matches = (pattern: RegExp): Validator<string> =>
  (value) => pattern.test(value)
    ? ok(value)
    : err(`Invalid format`);

// Compose validators
const validatePassword = combine(
  minLength(8),
  maxLength(100),
  matches(/[A-Z]/), // Has uppercase
  matches(/[a-z]/), // Has lowercase
  matches(/[0-9]/), // Has number
  matches(/[^A-Za-z0-9]/) // Has special char
);

// Object validation
interface UserInput {
  username: string;
  email: string;
  password: string;
}

function validateUserInput(input: UserInput): Result<UserInput, string[]> {
  const results = [
    validateUsername(input.username),
    validateEmail(input.email),
    validatePassword(input.password)
  ];
  
  // Collect all errors
  const errors = results
    .filter(r => r.isErr)
    .map(r => r.error);
  
  if (errors.length > 0) {
    return err(errors);
  }
  
  return ok(input);
}
```

## Parallel Operations

Handle multiple async operations efficiently:

```typescript
import { Result, tryR, collect, firstSuccess } from '@flyingrobots/zerothrow';

// Parallel fetching with all-or-nothing semantics
async function fetchUserData(userId: string): Promise<Result<UserData, Error>> {
  const [profileResult, settingsResult, statsResult] = await Promise.all([
    tryR(() => api.getProfile(userId)),
    tryR(() => api.getSettings(userId)),
    tryR(() => api.getStats(userId))
  ]);
  
  const allResults = collect([profileResult, settingsResult, statsResult]);
  
  if (allResults.isErr) {
    return err(new Error(`Failed to fetch user data: ${allResults.error}`));
  }
  
  const [profile, settings, stats] = allResults.value;
  return ok({ profile, settings, stats });
}

// Try multiple sources until one succeeds
async function fetchConfigFromSources(): Promise<Result<Config, Error[]>> {
  const sources = [
    tryR(() => fetchFromEnv()),
    tryR(() => fetchFromFile('./config.json')),
    tryR(() => fetchFromRemote('https://api.example.com/config')),
    Promise.resolve(ok(getDefaultConfig()))
  ];
  
  const results = await Promise.all(sources);
  return firstSuccess(results);
}

// Race conditions with proper error handling
async function fetchWithTimeout<T>(
  operation: () => Promise<Result<T, Error>>,
  timeoutMs: number
): Promise<Result<T, Error>> {
  const timeout = new Promise<Result<T, Error>>(resolve =>
    setTimeout(() => resolve(err(new Error('Operation timed out'))), timeoutMs)
  );
  
  return Promise.race([operation(), timeout]);
}
```

## Error Aggregation

Collect and handle multiple errors:

```typescript
import { Result, ok, err } from '@flyingrobots/zerothrow';

// Validation with detailed errors
interface ValidationError {
  field: string;
  message: string;
  code: string;
}

class ValidationErrors extends Error {
  constructor(public errors: ValidationError[]) {
    super(`Validation failed: ${errors.length} errors`);
  }
}

function validateForm(data: FormData): Result<ValidForm, ValidationErrors> {
  const errors: ValidationError[] = [];
  
  // Validate each field
  if (!data.username || data.username.length < 3) {
    errors.push({
      field: 'username',
      message: 'Username must be at least 3 characters',
      code: 'USERNAME_TOO_SHORT'
    });
  }
  
  if (!data.email?.includes('@')) {
    errors.push({
      field: 'email',
      message: 'Invalid email format',
      code: 'INVALID_EMAIL'
    });
  }
  
  if (!data.password || data.password.length < 8) {
    errors.push({
      field: 'password',
      message: 'Password must be at least 8 characters',
      code: 'PASSWORD_TOO_SHORT'
    });
  }
  
  if (errors.length > 0) {
    return err(new ValidationErrors(errors));
  }
  
  return ok(data as ValidForm);
}

// Handle aggregated errors
const result = validateForm(formData);
if (result.isErr) {
  result.error.errors.forEach(error => {
    highlightField(error.field);
    showFieldError(error.field, error.message);
  });
}
```

## State Machines

Model complex workflows with Results:

```typescript
type OrderState = 
  | { status: 'draft'; items: Item[] }
  | { status: 'validated'; items: Item[]; total: number }
  | { status: 'paid'; items: Item[]; total: number; paymentId: string }
  | { status: 'shipped'; items: Item[]; total: number; paymentId: string; trackingId: string };

type OrderError = 
  | { type: 'validation'; message: string }
  | { type: 'payment'; message: string }
  | { type: 'shipping'; message: string };

// State transitions return Results
function validateOrder(
  order: OrderState & { status: 'draft' }
): Result<OrderState & { status: 'validated' }, OrderError> {
  if (order.items.length === 0) {
    return err({ type: 'validation', message: 'Order has no items' });
  }
  
  const total = order.items.reduce((sum, item) => sum + item.price, 0);
  
  return ok({
    status: 'validated',
    items: order.items,
    total
  });
}

function processPayment(
  order: OrderState & { status: 'validated' }
): Result<OrderState & { status: 'paid' }, OrderError> {
  // Simulate payment processing
  if (Math.random() > 0.9) {
    return err({ type: 'payment', message: 'Payment declined' });
  }
  
  return ok({
    ...order,
    status: 'paid',
    paymentId: 'pay_' + Date.now()
  });
}

// Compose the workflow
function processOrder(items: Item[]): Result<OrderState, OrderError> {
  const draft: OrderState = { status: 'draft', items };
  
  return andThen(
    validateOrder(draft as any),
    validated => andThen(
      processPayment(validated as any),
      paid => shipOrder(paid as any)
    )
  );
}
```

## Dependency Injection

Use Results with dependency injection:

```typescript
import { Result, ok, err, tryR } from '@flyingrobots/zerothrow';

// Define service interfaces
interface Logger {
  log(message: string): void;
  error(message: string, error?: unknown): void;
}

interface Database {
  get<T>(key: string): Promise<Result<T, Error>>;
  set<T>(key: string, value: T): Promise<Result<void, Error>>;
}

interface EmailService {
  send(to: string, subject: string, body: string): Promise<Result<void, Error>>;
}

// Service container
class ServiceContainer {
  private services = new Map<string, any>();
  
  register<T>(name: string, service: T): void {
    this.services.set(name, service);
  }
  
  resolve<T>(name: string): Result<T, Error> {
    const service = this.services.get(name);
    if (!service) {
      return err(new Error(`Service ${name} not found`));
    }
    return ok(service);
  }
}

// Use Results for dependency resolution
class UserService {
  constructor(private container: ServiceContainer) {}
  
  async createUser(email: string, name: string): Promise<Result<User, Error>> {
    // Resolve dependencies
    const dbResult = this.container.resolve<Database>('database');
    if (dbResult.isErr) return dbResult;
    
    const emailResult = this.container.resolve<EmailService>('email');
    if (emailResult.isErr) return emailResult;
    
    const loggerResult = this.container.resolve<Logger>('logger');
    if (loggerResult.isErr) return loggerResult;
    
    const db = dbResult.value;
    const emailService = emailResult.value;
    const logger = loggerResult.value;
    
    // Use services
    const user = { id: generateId(), email, name };
    
    const saveResult = await db.set(`user:${user.id}`, user);
    if (saveResult.isErr) {
      logger.error('Failed to save user', saveResult.error);
      return saveResult;
    }
    
    const emailSendResult = await emailService.send(
      email,
      'Welcome!',
      `Hello ${name}, welcome to our service!`
    );
    
    if (emailSendResult.isErr) {
      logger.error('Failed to send welcome email', emailSendResult.error);
      // Non-critical error, continue
    }
    
    logger.log(`User ${user.id} created successfully`);
    return ok(user);
  }
}
```

## Next Steps

- Learn about [error handling strategies](./03-error-handling.md)
- Master [functional programming with Results](./04-functional-programming.md)
- Explore [testing strategies](./05-testing.md)
- See [real-world examples](../examples/)