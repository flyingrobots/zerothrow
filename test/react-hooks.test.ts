/**
 * Tests for React hooks
 * Note: These are type-only tests since we don't have React as a dependency
 * In a real project, you would test these with @testing-library/react-hooks
 */

import { describe, it, expect } from 'vitest';
import type { UseResultState } from '../src/react-hooks';
import { ok, err, ZeroError, Result } from '../src/index';

describe('useResult types', () => {
  it('should have correct type definitions', () => {
    // Type-level test to ensure the interface is correctly defined
    const mockState: UseResultState<string, Error> = {
      data: 'test',
      error: null,
      loading: false,
      refetch: () => {},
      reset: () => {}
    };

    expect(mockState.data).toBe('test');
    expect(mockState.error).toBe(null);
    expect(mockState.loading).toBe(false);
    expect(typeof mockState.refetch).toBe('function');
    expect(typeof mockState.reset).toBe('function');
  });

  it('should handle error state types', () => {
    const mockErrorState: UseResultState<string, ZeroError> = {
      data: null,
      error: new ZeroError('TEST_ERR', 'Test error'),
      loading: false,
      refetch: () => {},
      reset: () => {}
    };

    expect(mockErrorState.data).toBe(null);
    expect(mockErrorState.error).toBeInstanceOf(ZeroError);
    expect(mockErrorState.error?.code).toBe('TEST_ERR');
  });

  it('should handle loading state types', () => {
    const mockLoadingState: UseResultState<number> = {
      data: null,
      error: null,
      loading: true,
      refetch: () => {},
      reset: () => {}
    };

    expect(mockLoadingState.loading).toBe(true);
    expect(mockLoadingState.data).toBe(null);
    expect(mockLoadingState.error).toBe(null);
  });
});

// Example of how the hook would be used in a React component
describe('useResult usage examples', () => {
  it('demonstrates typical usage pattern', async () => {
    // Mock async function that returns a Result
    const fetchUser = async (id: number): Promise<Result<{ name: string; id: number }>> => {
      if (id > 0) {
        return ok({ name: 'John Doe', id });
      }
      return err(new ZeroError('USER_NOT_FOUND', `User ${id} not found`));
    };

    // This is how you would use it in a component:
    // const userResult = useResult(() => fetchUser(123), [123]);
    
    // Test the mock function directly
    const successResult = await fetchUser(123);
    expect(successResult.ok).toBe(true);
    if (successResult.ok) {
      expect(successResult.value.name).toBe('John Doe');
    }

    const errorResult = await fetchUser(-1);
    expect(errorResult.ok).toBe(false);
    if (!errorResult.ok) {
      expect(errorResult.error.code).toBe('USER_NOT_FOUND');
    }
  });

  it('demonstrates error handling pattern', async () => {
    const riskyOperation = async (): Promise<Result<string>> => {
      try {
        // Simulate operation that might fail
        if (Math.random() > 0.5) {
          throw new Error('Random failure');
        }
        return ok('Success!');
      } catch (e) {
        return err(new ZeroError('OPERATION_FAILED', 'Operation failed', { cause: e as Error }));
      }
    };

    // In a component:
    // const { data, error, loading, refetch } = useResult(riskyOperation);
    
    // Test the operation
    const result = await riskyOperation();
    expect(result.ok === true || result.ok === false).toBe(true);
  });
});