# ZeroThrow Tutorials

Step-by-step guides to master error handling with ZeroThrow.

## 🎯 Learning Path

### Beginner
1. **[Getting Started](./01-getting-started.md)**  
   Learn the basics of Result types and why they're better than exceptions.

### Intermediate
2. **[Advanced Patterns](./02-advanced-patterns.md)**  
   Master railway-oriented programming, error recovery, and validation pipelines.

3. **[Error Handling Strategies](./03-error-handling.md)**  
   Design robust error hierarchies, add context, and handle errors at boundaries.

### Advanced
4. **[Functional Programming](./04-functional-programming.md)**  
   Explore monadic patterns, lazy evaluation, and type-safe transformations.

## 📚 Tutorial Overview

### Getting Started (Beginner)
- Your first Result
- Why Result types?
- Basic patterns
- Working with async code
- Enhanced error information
- React integration basics

### Advanced Patterns (Intermediate)
- Railway-oriented programming
- Error recovery strategies
- Validation pipelines
- Parallel operations
- Error aggregation
- State machines
- Dependency injection

### Error Handling Strategies (Intermediate)
- Error design principles
- Error hierarchies
- Context and debugging
- Error boundaries
- Logging and monitoring
- User-facing errors
- Testing error cases

### Functional Programming (Advanced)
- Functor laws
- Monad patterns
- Composition techniques
- Functional pipelines
- Lazy evaluation
- Type-safe transformations

## 🚀 Quick Start Examples

### Basic Error Handling
```typescript
import { ok, err, Result } from '@zerothrow/zerothrow';

function divide(a: number, b: number): Result<number, string> {
  if (b === 0) {
    return err('Cannot divide by zero');
  }
  return ok(a / b);
}
```

### Async Operations
```typescript
import { tryR } from '@zerothrow/zerothrow';

const data = await tryR(async () => {
  const response = await fetch('/api/data');
  return response.json();
});
```

### React Hook
```typescript
import { useResult } from '@zerothrow/zerothrow/react';

function MyComponent() {
  const { data, error, loading } = useResult(
    () => fetchData(),
    []
  );
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  return <div>{data}</div>;
}
```

## 📖 Additional Resources

- **[API Reference](../api/)** - Complete API documentation
- **[Examples](../examples/)** - Real-world code examples
- **[Migration Guide](../guides/migration-guide.md)** - Migrate from other libraries
- **[Performance Guide](../guides/performance.md)** - Optimization tips

## 💡 Learning Tips

1. **Start Simple**: Begin with the Getting Started tutorial
2. **Practice**: Try the examples in your own code
3. **Build**: Create a small project using ZeroThrow
4. **Explore**: Dive into advanced patterns as needed
5. **Ask**: Join our community for help and discussions

## 🎓 Next Steps

After completing these tutorials:

1. Build a real application using ZeroThrow
2. Contribute examples to the documentation
3. Share your experience with the community
4. Explore the library internals
5. Create your own patterns and share them