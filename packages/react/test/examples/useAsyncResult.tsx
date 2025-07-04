import { useState, useEffect, useCallback } from 'react';
import { Result, ZeroThrow } from '@zerothrow/zerothrow';
const { ok, err, ZeroError } = ZeroThrow;

/**
 * Custom React hook for handling async operations with ZeroThrow Result type
 * Provides loading state, error handling, and data management
 */
export function useAsyncResult<T>(
  asyncFn: () => Promise<Result<T, ZeroError>>
) {
  const [result, setResult] = useState<Result<T, ZeroError> | null>(null);
  const [loading, setLoading] = useState(false);

  const execute = useCallback(async () => {
    setLoading(true);
    try {
      const res = await asyncFn();
      setResult(res);
    } catch (error) {
      // If the async function throws (shouldn't with proper Result usage)
      setResult(err(
        error instanceof ZeroError 
          ? error 
          : new ZeroError('UNKNOWN_ERR', String(error))
      ));
    } finally {
      setLoading(false);
    }
  }, [asyncFn]);

  return {
    result,
    loading,
    execute,
    data: result?.ok ? result.value : undefined,
    error: result?.ok === false ? result.error : undefined,
  };
}

// Example usage
export function UserProfile({ userId }: { userId: string }) {
  const { result: _result, loading, execute, data, error } = useAsyncResult(
    async () => fetchUser(userId)
  );

  useEffect(() => {
    execute();
  }, [userId, execute]);

  if (loading) return <div>Loading user...</div>;
  if (error) return <div>Error: {String(error)}</div>;
  if (!data) return null;

  return (
    <div>
      <h1>{data.name}</h1>
      <p>{data.email}</p>
    </div>
  );
}

// Example API function that returns Result
async function fetchUser(id: string): Promise<Result<User, ZeroError>> {
  try {
    const response = await fetch(`/api/users/${id}`);
    
    if (!response.ok) {
      return err(new ZeroError(
        'API_ERROR',
        `Failed to fetch user: ${response.statusText}`,
        { statusCode: response.status }
      ));
    }

    const user = await response.json();
    return ok(user);
  } catch (error) {
    return err(new ZeroError(
      'NETWORK_ERROR',
      `Network error: ${error}`,
      { cause: error instanceof Error ? error : undefined }
    ));
  }
}

interface User {
  id: string;
  name: string;
  email: string;
}