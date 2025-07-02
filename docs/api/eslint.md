# ESLint Plugin

ZeroThrow provides an ESLint rule to enforce Result-based error handling instead of throwing exceptions.

## Installation

The ESLint plugin is included with the main package:

```bash
npm install @flyingrobots/zerothrow
```

## Configuration

### .eslintrc.json

```json
{
  "extends": [
    // Your other extends...
  ],
  "plugins": [
    "@flyingrobots/zerothrow"
  ],
  "rules": {
    "@flyingrobots/zerothrow/no-throw": "error"
  }
}
```

### .eslintrc.js

```javascript
module.exports = {
  plugins: ['@flyingrobots/zerothrow'],
  rules: {
    '@flyingrobots/zerothrow/no-throw': 'error'
  }
};
```

### Flat Config (eslint.config.js)

```javascript
import zerothrow from '@flyingrobots/zerothrow/eslint';

export default [
  {
    plugins: {
      '@flyingrobots/zerothrow': zerothrow
    },
    rules: {
      '@flyingrobots/zerothrow/no-throw': 'error'
    }
  }
];
```

## The no-throw Rule

### Description

Disallows the use of `throw` statements, encouraging Result-based error handling instead.

### Rule Details

Examples of **incorrect** code:

```typescript
// ❌ Direct throw statements
function divide(a: number, b: number): number {
  if (b === 0) {
    throw new Error('Division by zero');
  }
  return a / b;
}

// ❌ Throwing in try blocks
function parseData(json: string) {
  try {
    const data = JSON.parse(json);
    if (!data.id) {
      throw new Error('Missing ID');
    }
    return data;
  } catch (e) {
    throw new Error('Parse failed');
  }
}

// ❌ Throwing in async functions
async function fetchUser(id: string) {
  const response = await fetch(`/api/users/${id}`);
  if (!response.ok) {
    throw new Error('User not found');
  }
  return response.json();
}

// ❌ Re-throwing errors
function processFile(path: string) {
  try {
    return readFileSync(path);
  } catch (error) {
    console.error('Read failed');
    throw error; // Re-throwing
  }
}
```

Examples of **correct** code:

```typescript
// ✅ Return Result types
import { ok, err, Result } from '@flyingrobots/zerothrow';

function divide(a: number, b: number): Result<number, string> {
  if (b === 0) {
    return err('Division by zero');
  }
  return ok(a / b);
}

// ✅ Use tryR for potentially throwing operations
import { tryR } from '@flyingrobots/zerothrow';

async function parseData(json: string): Promise<Result<Data, Error>> {
  return tryR(() => {
    const data = JSON.parse(json);
    if (!data.id) {
      return err(new Error('Missing ID'));
    }
    return ok(data);
  });
}

// ✅ Handle errors in async functions
async function fetchUser(id: string): Promise<Result<User, ZeroError>> {
  const response = await fetch(`/api/users/${id}`);
  if (!response.ok) {
    return err(wrap(
      new Error(`HTTP ${response.status}`),
      'USER_NOT_FOUND',
      'User not found',
      { userId: id, status: response.status }
    ));
  }
  
  return tryR(() => response.json());
}

// ✅ Wrap and return errors
function processFile(path: string): Result<Buffer, ZeroError> {
  try {
    const content = readFileSync(path);
    return ok(content);
  } catch (error) {
    return err(wrap(
      error,
      'FILE_READ_ERROR',
      'Failed to read file',
      { path }
    ));
  }
}
```

### Options

The rule accepts an options object with the following properties:

```typescript
interface NoThrowOptions {
  allowInTests?: boolean;
  allowedPatterns?: string[];
  message?: string;
}
```

#### allowInTests

Allow throw statements in test files (default: `false`).

```json
{
  "@flyingrobots/zerothrow/no-throw": ["error", {
    "allowInTests": true
  }]
}
```

This allows throws in files matching common test patterns:
- `*.test.ts`
- `*.spec.ts`
- `__tests__/*.ts`

#### allowedPatterns

Array of regex patterns for files where throws are allowed.

```json
{
  "@flyingrobots/zerothrow/no-throw": ["error", {
    "allowedPatterns": [
      "src/legacy/.*",
      "scripts/.*\\.js$"
    ]
  }]
}
```

#### message

Custom error message to display.

```json
{
  "@flyingrobots/zerothrow/no-throw": ["error", {
    "message": "Use Result types instead of throwing. See: https://docs.example.com/error-handling"
  }]
}
```

### Autofixing

The rule provides suggestions but does not auto-fix, as converting throws to Results requires understanding the function's return type and error handling strategy.

When you encounter a violation, consider:

1. **Change return type** to `Result<T, E>`
2. **Use `tryR`** for wrapping throwing operations
3. **Use `wrap`** to enhance error context
4. **Handle errors explicitly** at appropriate boundaries

## Integration Patterns

### Gradual Migration

Start by enabling the rule as a warning:

```json
{
  "rules": {
    "@flyingrobots/zerothrow/no-throw": "warn"
  }
}
```

Then migrate file by file:

```typescript
// Before
export function parseConfig(json: string): Config {
  const data = JSON.parse(json); // Can throw
  if (!isValidConfig(data)) {
    throw new Error('Invalid config');
  }
  return data;
}

// After
export function parseConfig(json: string): Result<Config, ZeroError> {
  return tryR(
    () => {
      const data = JSON.parse(json);
      if (!isValidConfig(data)) {
        return err(new ZeroError('INVALID_CONFIG', 'Invalid configuration format'));
      }
      return ok(data);
    },
    (error) => wrap(error, 'CONFIG_PARSE_ERROR', 'Failed to parse configuration')
  );
}
```

### Working with External Libraries

When working with libraries that throw:

```typescript
// Wrap external library calls
import { externalLibrary } from 'some-package';

function safeLibraryCall(input: string): Result<Output, ZeroError> {
  return tryR(
    () => externalLibrary.process(input),
    (error) => wrap(error, 'EXTERNAL_LIB_ERROR', 'External library failed', {
      library: 'some-package',
      method: 'process'
    })
  );
}
```

### Test Files

If you enable `allowInTests`, you can still throw in test files:

```typescript
// users.test.ts
describe('User validation', () => {
  it('should reject invalid emails', () => {
    const result = validateEmail('not-an-email');
    expect(result.isErr).toBe(true);
    
    // Throws are allowed in tests with allowInTests: true
    if (result.isOk) {
      throw new Error('Expected validation to fail');
    }
  });
});
```

### Disable for Specific Lines

When necessary, disable the rule for specific lines:

```typescript
function legacyFunction() {
  // eslint-disable-next-line @flyingrobots/zerothrow/no-throw
  throw new Error('Legacy code - to be refactored');
}
```

## Common Patterns

### API Route Handlers

```typescript
// Express route handler
app.get('/api/users/:id', async (req, res) => {
  const result = await fetchUser(req.params.id);
  
  if (result.isErr) {
    const error = result.error;
    res.status(error.code === 'NOT_FOUND' ? 404 : 500).json({
      error: error.message,
      code: error.code
    });
    return;
  }
  
  res.json(result.value);
});
```

### React Error Boundaries

```typescript
class ErrorBoundary extends Component {
  componentDidCatch(error: Error) {
    // At the boundary, we might need to throw
    // eslint-disable-next-line @flyingrobots/zerothrow/no-throw
    throw error; // Let React handle it
  }
}
```

### Worker Threads

```typescript
// Worker code
self.addEventListener('message', async (event) => {
  const result = await processData(event.data);
  
  if (result.isErr) {
    self.postMessage({
      type: 'error',
      error: result.error
    });
  } else {
    self.postMessage({
      type: 'success',
      data: result.value
    });
  }
});
```

## Troubleshooting

### Rule Not Working

1. Ensure the plugin is installed:
   ```bash
   npm ls @flyingrobots/zerothrow
   ```

2. Check ESLint can find the plugin:
   ```bash
   npx eslint --print-config .eslintrc.json | grep zerothrow
   ```

3. Verify the rule is enabled:
   ```bash
   npx eslint --debug src/example.ts
   ```

### False Positives

If you encounter false positives, consider:

1. Using `allowedPatterns` for legacy code
2. Disabling for specific lines with comments
3. Reporting issues to the maintainers

## Next Steps

- [Explore type utilities](./type-utilities.md)
- [Learn migration strategies](../guides/migration-guide.md)
- [See real examples](../examples/)