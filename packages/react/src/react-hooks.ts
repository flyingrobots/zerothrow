import { useState, useEffect, useCallback } from 'react';
import { ZeroThrow } from '@zerothrow/core';

export interface UseResultState<T, E extends globalThis.Error = InstanceType<typeof ZeroThrow.ZeroError>> {
  data: T | null;
  error: E | null;
  loading: boolean;
  refetch: () => void;
  reset: () => void;
}

/**
 * React hook for handling async operations with Result types
 */
export function useResult<T, E extends globalThis.Error = InstanceType<typeof ZeroThrow.ZeroError>>(
  fn: () => Promise<ZeroThrow.Result<T, E>>,
  deps: React.DependencyList = []
): UseResultState<T, E> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<E | null>(null);
  const [loading, setLoading] = useState(true);

  const execute = useCallback(async () => {
    setLoading(true);
    setError(null);

    const result = await fn();

    if (result.ok) {
      setData(result.value);
      setError(null);
    } else {
      setData(null);
      setError(result.error);
    }

    setLoading(false);
  }, deps);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    execute();
  }, [execute]);

  return {
    data,
    error,
    loading,
    refetch: execute,
    reset,
  };
}
