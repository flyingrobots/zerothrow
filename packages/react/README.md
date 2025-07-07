# @zerothrow/react

> **🧠 ZeroThrow Layers**  
> • **ZT** – primitives (`try`, `tryAsync`, `ok`, `err`)  
> • **Result** – combinators (`map`, `andThen`, `match`)  
> • **ZeroThrow** – utilities (`collect`, `enhanceAsync`)  
> • **@zerothrow/*** – ecosystem packages (resilience, jest, etc)

> **ZeroThrow Ecosystem** · [Packages ⇢](https://github.com/zerothrow/zerothrow/blob/main/ECOSYSTEM.md)

[![CI](https://github.com/zerothrow/zerothrow/actions/workflows/ci.yml/badge.svg)](https://github.com/zerothrow/zerothrow/actions)
![npm](https://img.shields.io/npm/v/@zerothrow/react)
![types](https://img.shields.io/npm/types/@zerothrow/react)
![ecosystem](https://img.shields.io/badge/zerothrow-ecosystem-blue)


[![CI](https://github.com/zerothrow/zerothrow/actions/workflows/ci.yml/badge.svg)](https://github.com/zerothrow/zerothrow/actions)
![npm](https://img.shields.io/npm/v/@zerothrow/react)
![license](https://img.shields.io/npm/l/@zerothrow/react)
![types](https://img.shields.io/npm/types/@zerothrow/react)

React hooks for type-safe error handling with Result types. Stop throwing, start returning.

<div align="center">
<img src="https://raw.githubusercontent.com/flyingrobots/image-dump/refs/heads/main/optimized/marketing/brand/zerothrow-react.webp" height="300" />
</div>


## 🎉 Initial Release - v0.1.1

We're excited to release @zerothrow/react! This package brings the power of Result types to React applications with:
- `useResult` - Async operations with Result types
- `useResilientResult` - Integration with @zerothrow/resilience policies
- `ResultBoundary` - Error boundaries that return Results instead of crashing

## Why @zerothrow/react?

React error handling is fragmented:
- `try/catch` in effects doesn't compose
- `isLoading`/`isError`/`data` patterns are repetitive
- Error boundaries are coarse and destructive
- Async errors surprise developers

**Solution:** Result-based hooks that make errors first-class citizens.

## Installation

```bash
npm install @zerothrow/react @zerothrow/core
# or
pnpm add @zerothrow/react @zerothrow/core
```

For resilient operations:
```bash
npm install @zerothrow/resilience
```

## Quick Start

### Basic Async Operations

```tsx
import { useResult } from '@zerothrow/react'
import { ZT } from '@zerothrow/core'

function UserProfile({ userId }: { userId: string }) {
  const { result, loading, reload } = useResult(
    async () => {
      const response = await fetch(`/api/users/${userId}`)
      if (!response.ok) {
        return ZT.err(new Error(`Failed to fetch user: ${response.status}`))
      }
      const user = await response.json()
      return ZT.ok(user)
    },
    { deps: [userId] }
  )

  if (loading) return <Spinner />

  return result?.match({
    ok: user => <UserCard {...user} />,
    err: error => (
      <ErrorMessage error={error}>
        <button onClick={reload}>Retry</button>
      </ErrorMessage>
    )
  }) ?? null
}
```

### Resilient Operations

```tsx
import { useResilientResult } from '@zerothrow/react'
import { RetryPolicy, CircuitBreakerPolicy } from '@zerothrow/resilience'

function DataDashboard() {
  const policy = RetryPolicy.exponential({ maxRetries: 3 })
    .chain(CircuitBreakerPolicy.create({ 
      failureThreshold: 5,
      resetTimeout: 30000 
    }))

  const { result, loading, retryCount, nextRetryAt, circuitState } = useResilientResult(
    async () => {
      const data = await fetchDashboardData() // might throw
      return data
    },
    policy
  )

  if (loading) {
    return nextRetryAt ? (
      <div>
        Retrying in {Math.round((nextRetryAt - Date.now()) / 1000)}s...
        (Attempt {retryCount + 1})
      </div>
    ) : (
      <Spinner />
    )
  }

  if (circuitState === 'open') {
    return <Alert>Service temporarily unavailable. Circuit breaker is open.</Alert>
  }

  return result?.match({
    ok: data => <Dashboard data={data} />,
    err: error => <ErrorView error={error} retries={retryCount} />
  }) ?? null
}
```

### Error Boundaries

```tsx
import { ResultBoundary } from '@zerothrow/react'

function App() {
  return (
    <ResultBoundary
      fallback={(result, reset) => (
        <ErrorFallback
          error={result.error}
          onRetry={reset}
        />
      )}
      onError={(error, errorInfo) => {
        console.error('Boundary caught:', error)
        sendToTelemetry(error, errorInfo)
      }}
    >
      <Router>
        <Routes>
          {/* Your app routes */}
        </Routes>
      </Router>
    </ResultBoundary>
  )
}
```

### Safe Context Access

```tsx
import { useResultContext, createResultContext } from '@zerothrow/react'

// Using with existing context
const ThemeContext = createContext<Theme | undefined>(undefined)

function ThemedButton() {
  const themeResult = useResultContext(ThemeContext)
  
  return themeResult.match({
    ok: (theme) => (
      <button style={{ background: theme.primary }}>
        Click me
      </button>
    ),
    err: (error) => (
      <button>Default Button (no theme)</button>
    )
  })
}

// Creating a Result-based context
const { Provider, useContext } = createResultContext<UserSettings>('UserSettings')

function SettingsForm() {
  const settingsResult = useContext()
  
  return settingsResult.match({
    ok: (settings) => <Form initialValues={settings} />,
    err: () => <Alert>Please configure settings first</Alert>
  })
}
```

## Core API

### `useResult`

Hook for async operations that return Results.

```typescript
function useResult<T, E = Error>(
  fn: () => Promise<Result<T, E>> | Result<T, E>,
  options?: UseResultOptions
): UseResultReturn<T, E>

interface UseResultOptions {
  immediate?: boolean  // Execute on mount (default: true)
  deps?: DependencyList // Re-execute when deps change
}

interface UseResultReturn<T, E> {
  result: Result<T, E> | undefined
  loading: boolean
  reload: () => void
  reset: () => void
}
```

### `useResilientResult`

Hook for async operations with resilience policies.

```typescript
function useResilientResult<T, E = Error>(
  fn: () => Promise<T>,
  policy: Policy<T, E>,
  options?: UseResilientResultOptions
): UseResilientResultReturn<T, E>

interface UseResilientResultReturn<T, E> {
  result: Result<T, E> | undefined
  loading: boolean
  retryCount: number
  nextRetryAt?: number
  circuitState?: CircuitState
  reload: () => void
  reset: () => void
}
```

### `ResultBoundary`

Error boundary that converts thrown errors to Results.

```typescript
interface ResultBoundaryProps {
  fallback: (result: Result<never, Error>, reset: () => void) => ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  children: ReactNode
}
```

### `useResultContext`

Safe context access that returns Results instead of throwing.

```typescript
function useResultContext<T>(
  context: Context<T | undefined | null>,
  options?: { contextName?: string }
): Result<T, ContextError>
```

### `createResultContext`

Helper to create Result-based contexts with companion hooks.

```typescript
function createResultContext<T>(contextName: string): {
  Provider: React.Provider<T | undefined>
  useContext: () => Result<T, ContextError>
  Context: React.Context<T | undefined>
}
```

## Patterns

### Form Validation

```tsx
function ContactForm() {
  const { result: submitResult, loading, reload } = useResult(
    async () => {
      const validation = validateForm(formData)
      if (!validation.ok) return validation
      
      const response = await submitForm(formData)
      return response
    },
    { immediate: false } // Don't submit on mount
  )

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    reload() // Trigger submission
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* form fields */}
      
      {submitResult?.match({
        ok: () => <SuccessMessage />,
        err: error => <ValidationErrors error={error} />
      })}
      
      <button type="submit" disabled={loading}>
        {loading ? 'Submitting...' : 'Submit'}
      </button>
    </form>
  )
}
```

### Parallel Data Fetching

```tsx
function Dashboard() {
  const userResult = useResult(() => fetchUser())
  const statsResult = useResult(() => fetchStats())
  const notificationsResult = useResult(() => fetchNotifications())

  const allLoading = userResult.loading || statsResult.loading || notificationsResult.loading

  if (allLoading) return <DashboardSkeleton />

  return (
    <div>
      {userResult.result?.match({
        ok: user => <UserWidget user={user} />,
        err: () => <UserWidgetError onRetry={userResult.reload} />
      })}
      
      {statsResult.result?.match({
        ok: stats => <StatsWidget stats={stats} />,
        err: () => <StatsWidgetError onRetry={statsResult.reload} />
      })}
      
      {notificationsResult.result?.match({
        ok: notifs => <NotificationsList notifications={notifs} />,
        err: () => <NotificationsError onRetry={notificationsResult.reload} />
      })}
    </div>
  )
}
```

### Dependent Queries

```tsx
function PostDetails({ postId }: { postId: string }) {
  const postResult = useResult(() => fetchPost(postId), { deps: [postId] })
  
  const authorResult = useResult(
    async () => {
      if (!postResult.result?.ok) return ZT.err(new Error('No post'))
      return fetchAuthor(postResult.result.value.authorId)
    },
    { deps: [postResult.result] }
  )

  return (
    <div>
      {postResult.result?.match({
        ok: post => <PostContent post={post} />,
        err: error => <ErrorMessage error={error} />
      })}
      
      {authorResult.result?.match({
        ok: author => <AuthorBio author={author} />,
        err: () => null // Silent fail for author
      })}
    </div>
  )
}
```

## Testing

```tsx
import { renderHook, waitFor } from '@testing-library/react'
import { useResult } from '@zerothrow/react'
import { ZT } from '@zerothrow/core'

test('fetches user successfully', async () => {
  const mockFetch = vi.fn().mockResolvedValue(ZT.ok({ id: 1, name: 'Alice' }))
  
  const { result } = renderHook(() => useResult(mockFetch))
  
  expect(result.current.loading).toBe(true)
  
  await waitFor(() => {
    expect(result.current.loading).toBe(false)
    expect(result.current.result?.value).toEqual({ id: 1, name: 'Alice' })
  })
})
```

## Best Practices

1. **Return Results from async functions** - Don't throw
2. **Use policies for resilience** - Let policies handle retries
3. **Provide loading feedback** - Especially with retry delays
4. **Test error paths** - Results make this easy
5. **Compose at the edge** - Keep components Result-aware

## License

MIT