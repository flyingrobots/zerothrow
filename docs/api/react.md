# React Integration

ZeroThrow provides a powerful React hook for handling asynchronous operations with proper error handling.

## useResult Hook

A React hook that manages asynchronous operations returning Result types.

### Signature

```typescript
function useResult<T, E = Error>(
  fn: () => Promise<Result<T, E>>,
  deps?: DependencyList
): UseResultState<T, E>
```

### Returns

```typescript
interface UseResultState<T, E> {
  data: T | undefined;
  error: E | undefined;
  loading: boolean;
  refetch: () => Promise<void>;
  reset: () => void;
}
```

### Basic Usage

```typescript
import { useResult } from '@flyingrobots/zerothrow/react';
import { tryR } from '@flyingrobots/zerothrow';

function UserProfile({ userId }: { userId: string }) {
  const { data, error, loading } = useResult(
    () => tryR(() => fetchUser(userId)),
    [userId]
  );

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!data) return null;

  return <div>Welcome, {data.name}!</div>;
}
```

## Hook Properties

### data

The successful value from the Result, or `undefined` if loading or errored.

```typescript
const { data } = useResult(() => fetchUser(id), [id]);

// TypeScript knows data is User | undefined
if (data) {
  console.log(data.name); // Safe access
}
```

### error

The error value from the Result, or `undefined` if loading or successful.

```typescript
const { error } = useResult(() => fetchUser(id), [id]);

if (error) {
  // Handle different error types
  if (error instanceof ZeroError) {
    console.error(`Error ${error.code}: ${error.message}`);
  }
}
```

### loading

Boolean indicating if the async operation is in progress.

```typescript
const { loading } = useResult(() => fetchData(), []);

return loading ? <Spinner /> : <Content />;
```

### refetch

Function to manually trigger a refetch of the data.

```typescript
const { data, refetch } = useResult(() => fetchUser(id), [id]);

const handleRefresh = async () => {
  await refetch();
  toast.success('Data refreshed!');
};

return (
  <div>
    <UserInfo user={data} />
    <button onClick={handleRefresh}>Refresh</button>
  </div>
);
```

### reset

Function to reset the hook state to initial values.

```typescript
const { data, error, reset } = useResult(() => fetchData(), []);

const handleReset = () => {
  reset(); // Clears data and error, sets loading to false
};
```

## Advanced Examples

### Form Submission

```typescript
function ContactForm() {
  const [formData, setFormData] = useState({ email: '', message: '' });
  
  const { loading, error, refetch } = useResult(
    async () => {
      if (!formData.email || !formData.message) {
        return ok(undefined); // Skip submission
      }
      
      return tryR(
        () => submitContact(formData),
        (err) => wrap(err, 'SUBMIT_FAILED', 'Failed to submit form')
      );
    },
    [] // Empty deps, manual trigger only
  );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await refetch();
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={formData.email}
        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
        disabled={loading}
      />
      <textarea
        value={formData.message}
        onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
        disabled={loading}
      />
      {error && <div className="error">{error.message}</div>}
      <button type="submit" disabled={loading}>
        {loading ? 'Sending...' : 'Send'}
      </button>
    </form>
  );
}
```

### Data Fetching with Dependencies

```typescript
function ProductDetails({ productId, includeReviews }: Props) {
  const { data: product, error, loading } = useResult(
    async () => {
      const productResult = await tryR(() => 
        api.getProduct(productId)
      );
      
      if (productResult.isErr || !includeReviews) {
        return productResult;
      }
      
      const reviewsResult = await tryR(() => 
        api.getProductReviews(productId)
      );
      
      if (reviewsResult.isErr) {
        // Product loaded but reviews failed - still show product
        console.error('Failed to load reviews:', reviewsResult.error);
        return productResult;
      }
      
      return ok({
        ...productResult.value,
        reviews: reviewsResult.value
      });
    },
    [productId, includeReviews] // Re-fetch when these change
  );

  if (loading) return <ProductSkeleton />;
  if (error) return <ErrorMessage error={error} />;
  if (!product) return null;

  return (
    <div>
      <ProductInfo product={product} />
      {product.reviews && <ReviewList reviews={product.reviews} />}
    </div>
  );
}
```

### Polling Pattern

```typescript
function LiveDashboard() {
  const [isPaused, setIsPaused] = useState(false);
  
  const { data, error, loading, refetch } = useResult(
    () => tryR(() => fetchDashboardData()),
    [] // Manual polling control
  );

  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      refetch();
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(interval);
  }, [isPaused, refetch]);

  return (
    <div>
      <button onClick={() => setIsPaused(!isPaused)}>
        {isPaused ? 'Resume' : 'Pause'} Updates
      </button>
      {loading && <LoadingIndicator />}
      {error && <ErrorBanner error={error} onRetry={refetch} />}
      {data && <DashboardContent data={data} />}
    </div>
  );
}
```

### Error Handling Patterns

```typescript
function DataView() {
  const { data, error, loading, refetch } = useResult(
    () => fetchData(),
    []
  );

  // Custom error rendering based on error type
  const renderError = (error: unknown) => {
    if (error instanceof ZeroError) {
      switch (error.code) {
        case 'NETWORK_ERROR':
          return (
            <Alert type="error">
              Network connection failed. Please check your internet.
              <button onClick={refetch}>Try Again</button>
            </Alert>
          );
        
        case 'AUTH_FAILED':
          return (
            <Alert type="warning">
              Your session has expired. Please log in again.
              <Link to="/login">Go to Login</Link>
            </Alert>
          );
        
        case 'NOT_FOUND':
          return (
            <Alert type="info">
              The requested data was not found.
              <Link to="/">Back to Home</Link>
            </Alert>
          );
        
        default:
          return (
            <Alert type="error">
              An unexpected error occurred: {error.message}
              <button onClick={refetch}>Retry</button>
            </Alert>
          );
      }
    }
    
    return <Alert type="error">Unknown error occurred</Alert>;
  };

  if (loading) return <LoadingSpinner />;
  if (error) return renderError(error);
  if (!data) return null;

  return <DataDisplay data={data} />;
}
```

### Optimistic Updates

```typescript
function TodoList() {
  const [optimisticTodos, setOptimisticTodos] = useState<Todo[]>([]);
  
  const { data: todos, loading, refetch } = useResult(
    () => tryR(() => fetchTodos()),
    []
  );

  const addTodo = async (text: string) => {
    const tempId = `temp-${Date.now()}`;
    const newTodo = { id: tempId, text, completed: false };
    
    // Optimistic update
    setOptimisticTodos(prev => [...prev, newTodo]);
    
    const result = await tryR(() => api.createTodo(text));
    
    if (result.isErr) {
      // Rollback on error
      setOptimisticTodos(prev => prev.filter(t => t.id !== tempId));
      toast.error('Failed to create todo');
    } else {
      // Refresh to get server state
      await refetch();
      setOptimisticTodos([]);
    }
  };

  const displayTodos = [...(todos || []), ...optimisticTodos];

  return (
    <div>
      <TodoInput onAdd={addTodo} />
      {loading && todos === undefined ? (
        <LoadingList />
      ) : (
        <TodoItems todos={displayTodos} />
      )}
    </div>
  );
}
```

### Debounced Search

```typescript
function SearchableList() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Debounce the search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const { data, loading, error } = useResult(
    async () => {
      if (!debouncedQuery) {
        return ok([]); // Empty query returns empty results
      }
      
      return tryR(
        () => searchItems(debouncedQuery),
        (err) => wrap(err, 'SEARCH_FAILED', 'Search failed')
      );
    },
    [debouncedQuery] // Only re-fetch when debounced query changes
  );

  return (
    <div>
      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Search..."
      />
      {loading && <SearchIndicator />}
      {error && <ErrorMessage error={error} />}
      {data && (
        <SearchResults
          results={data}
          query={debouncedQuery}
        />
      )}
    </div>
  );
}
```

## Testing

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { useResult } from '@flyingrobots/zerothrow/react';

describe('useResult', () => {
  it('handles successful data fetching', async () => {
    const { result } = renderHook(() =>
      useResult(() => Promise.resolve(ok({ name: 'Test' })), [])
    );

    expect(result.current.loading).toBe(true);
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual({ name: 'Test' });
      expect(result.current.error).toBeUndefined();
    });
  });

  it('handles errors correctly', async () => {
    const { result } = renderHook(() =>
      useResult(() => Promise.resolve(err('Failed')), [])
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toBeUndefined();
      expect(result.current.error).toBe('Failed');
    });
  });

  it('refetches data when refetch is called', async () => {
    let count = 0;
    const { result } = renderHook(() =>
      useResult(() => Promise.resolve(ok(++count)), [])
    );

    await waitFor(() => {
      expect(result.current.data).toBe(1);
    });

    await result.current.refetch();

    await waitFor(() => {
      expect(result.current.data).toBe(2);
    });
  });
});
```

## Best Practices

1. **Always handle loading states** - Show appropriate UI feedback
2. **Type your errors** - Use specific error types for better error handling
3. **Use dependencies wisely** - Only include values that should trigger refetch
4. **Handle edge cases** - Consider empty states, network failures, etc.
5. **Avoid excessive polling** - Use WebSockets or SSE for real-time data
6. **Memoize expensive operations** - Prevent unnecessary recalculations
7. **Clean up side effects** - Cancel requests when component unmounts

## Next Steps

- [Configure ESLint rules](./eslint.md)
- [Explore type utilities](./type-utilities.md)
- [See more examples](../examples/)