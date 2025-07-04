# ZeroThrow Documentation

Welcome to the ZeroThrow documentation directory. Here you'll find detailed guides and specifications for the project.

## Table of Contents

### 📚 Available Documents

#### API Reference
Complete API documentation with TypeScript types and examples.

- **[API Overview](./api/README.md)** - Quick reference and installation
- **[Core Types](./api/core-types.md)** - Result, Ok, Err, and ZeroError types
- **[Core Functions](./api/core-functions.md)** - ok, err, tryR, and wrap functions
- **[Combinators](./api/combinators.md)** - Functional programming patterns
- **[React Integration](./api/react.md)** - useResult hook and patterns
- **[ESLint Plugin](./api/eslint.md)** - no-throw rule configuration
- **[Type Utilities](./api/type-utilities.md)** - Advanced TypeScript utilities

#### Tutorials
Step-by-step learning path from beginner to advanced.

- **[Tutorial Overview](./tutorials/README.md)** - Learning path guide
- **[Getting Started](./tutorials/01-getting-started.md)** - Basics of Result types
- **[Advanced Patterns](./tutorials/02-advanced-patterns.md)** - Railway-oriented programming
- **[Error Handling](./tutorials/03-error-handling.md)** - Error design strategies
- **[Functional Programming](./tutorials/04-functional-programming.md)** - Monadic patterns

#### Examples
Real-world code examples demonstrating practical usage.

- **[Examples Overview](./examples/README.md)** - Available examples
- **[Express API](./examples/express-api.ts)** - REST API with error handling
- **[File Processor](./examples/file-processor.ts)** - File I/O operations
- **[React Form](./examples/react-form.tsx)** - Form validation and submission

#### Guides and Specifications
- **[Git Hooks Setup](./githooks.md)** - Enforce no-throw discipline in commits
- **[Technical Specification](./zerothrow-spec.md)** - Architecture and design details

### 🚀 Quick Links

- **Get Started**: See the main [README](../README.md) for installation and basic usage
- **API Reference**: Browse the comprehensive [API documentation](./api/README.md)
- **Contributing**: Review our [contributing guidelines](../README.md#contributing)

### 📖 Document Overview

#### API Reference (`api/`)
- **Core Types**: Result<T,E>, Ok<T>, Err<E>, ZeroError, ErrorCode, ErrorContext
- **Core Functions**: ok(), err(), tryR(), wrap()
- **Combinators**: andThen, map, mapErr, orElse, unwrapOr, pipe, collect
- **React Hook**: useResult with loading states and error handling
- **ESLint Rule**: no-throw rule configuration and patterns
- **Type Utilities**: Advanced TypeScript patterns and type inference

#### Tutorials (`tutorials/`)
- **Getting Started**: Basic concepts, first Result, async operations
- **Advanced Patterns**: Railway programming, error recovery, validation
- **Error Handling**: Error hierarchies, context, boundaries, monitoring
- **Functional Programming**: Monads, functors, composition, lazy evaluation

#### Examples (`examples/`)
- **Express API**: REST endpoints, validation, error responses
- **File Processor**: I/O operations, parsing, batch processing
- **React Form**: Validation, async checks, error feedback

#### Specifications
- **Git Hooks**: Automated setup, Husky configuration, pre-commit/push hooks
- **Technical Spec**: Architecture, API design, testing, performance, security

### 💡 Need Help?

- **Issues**: [GitHub Issues](https://github.com/zerothrow/zerothrow/issues)
- **Discussions**: [GitHub Discussions](https://github.com/zerothrow/zerothrow/discussions)
- **Email**: james@zerothrow.dev