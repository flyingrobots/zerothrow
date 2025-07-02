# ZeroThrow Examples

Real-world examples demonstrating ZeroThrow in various scenarios.

## 📁 Available Examples

### 1. [Interactive Playground](./interactive-playground.html) 🎮
Browser-based playground to experiment with ZeroThrow:
- Live code editor with syntax highlighting
- Pre-built examples for common patterns
- Real-time console output
- No setup required - **open locally in your browser**

> **Note**: The playground is a standalone HTML file. Download and open it locally for the best experience.

### 2. [Express API](./express-api.ts)
Complete REST API implementation with:
- Service layer with Result-based error handling
- Input validation
- Database operations
- Error mapping to HTTP status codes
- Structured error responses

### 3. [File Processor](./file-processor.ts)
File operations with proper error handling:
- Reading and writing files
- Directory processing
- JSON and CSV parsing
- Batch processing with progress
- Error recovery strategies

### 4. [React Form](./react-form.tsx)
Interactive form with validation:
- Field-level validation
- Async email availability check
- Form submission with error handling
- useResult hook integration
- User feedback and error recovery

## 🚀 Quick Examples

### Basic Error Handling
```typescript
import { Result, ok, err } from '@flyingrobots/zerothrow';

function parseAge(input: string): Result<number, string> {
  const age = parseInt(input);
  
  if (isNaN(age)) {
    return err('Invalid age format');
  }
  
  if (age < 0 || age > 150) {
    return err('Age must be between 0 and 150');
  }
  
  return ok(age);
}
```

### Async Operations
```typescript
import { tryR, wrap } from '@flyingrobots/zerothrow';

async function fetchUserData(userId: string): Promise<Result<User, ZeroError>> {
  return tryR(
    async () => {
      const response = await fetch(`/api/users/${userId}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response.json();
    },
    (error) => wrap(
      error, 
      'FETCH_USER_FAILED', 
      'Failed to fetch user data',
      { userId }
    )
  );
}
```

### Chaining Operations
```typescript
import { andThen, map } from '@flyingrobots/zerothrow';

const result = await fetchUserData('123');

const displayName = andThen(result, (user) => {
  if (!user.firstName || !user.lastName) {
    return err('User name incomplete');
  }
  return ok(`${user.firstName} ${user.lastName}`);
});

const upperCaseName = map(displayName, (name) => name.toUpperCase());
```

### React Hook Usage
```typescript
import { useResult } from '@flyingrobots/zerothrow/react';

function UserProfile({ userId }: { userId: string }) {
  const { data, error, loading, refetch } = useResult(
    () => fetchUserData(userId),
    [userId]
  );

  if (loading) return <LoadingSpinner />;
  
  if (error) {
    return (
      <ErrorMessage error={error}>
        <button onClick={refetch}>Try Again</button>
      </ErrorMessage>
    );
  }
  
  return <UserDetails user={data} />;
}
```

## 🎯 Example Categories

### API Development
- REST API error handling
- GraphQL resolver patterns
- WebSocket error management
- gRPC service implementation

### Data Processing
- File I/O operations
- Stream processing
- Batch operations
- ETL pipelines

### Frontend Applications
- Form validation
- API integration
- State management
- Error boundaries

### Backend Services
- Database operations
- Message queue handling
- Cron job error handling
- Microservice communication

## 📝 Running the Examples

1. **Clone the repository**
   ```bash
   git clone https://github.com/zerothrow/zerothrow
   cd zerothrow/docs/examples
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run TypeScript examples**
   ```bash
   npx ts-node express-api.ts
   npx ts-node file-processor.ts
   ```

4. **Run React example**
   ```bash
   # In a React app
   npm start
   ```

## 🤝 Contributing Examples

We welcome example contributions! To add your example:

1. Create a new file in the examples directory
2. Include comprehensive comments
3. Demonstrate both success and error cases
4. Show error recovery strategies
5. Submit a pull request

### Example Template
```typescript
/**
 * Example: [Your Example Name]
 * 
 * This example demonstrates [what it shows]
 */

import { Result, ok, err } from '@flyingrobots/zerothrow';

// Your example code here

// Usage section showing how to use the example
async function usage() {
  // Show success case
  // Show error case
  // Show error recovery
}

export { /* exported items */ };
```

## 📚 Additional Resources

- [API Documentation](../api/)
- [Tutorials](../tutorials/)
- [Migration Guide](../guides/migration-guide.md)
- [Best Practices](../guides/best-practices.md)