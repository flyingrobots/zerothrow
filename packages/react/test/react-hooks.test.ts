/**
 * Tests for React hooks
 * Note: These are type-only tests since we don't have React as a dependency
 * In a real project, you would test these with @testing-library/react-hooks
 */

import { describe, it, expect } from 'vitest';
import type { UseResultState } from '../src/react-hooks.js';
import { ZT, ZeroThrow } from '@zerothrow/core';

describe('useResult types', () => {
  it('should have correct type definitions', () => {
    // Type-level test to ensure the interface is correctly defined
    const mockState: UseResultState<string, Error> = {
      data: 'test',
      error: null,
      loading: false,
      refetch: () => {},
      reset: () => {},
    };

    expect(mockState.data).toBe('test');
    expect(mockState.error).toBe(null);
    expect(mockState.loading).toBe(false);
    expect(typeof mockState.refetch).toBe('function');
    expect(typeof mockState.reset).toBe('function');
  });

  it('should handle error state types', () => {
    const mockErrorState: UseResultState<string, ZeroThrow.ZeroError> = {
      data: null,
      error: new ZeroThrow.ZeroError('TEST_ERR', 'Test error'),
      loading: false,
      refetch: () => {},
      reset: () => {},
    };

    expect(mockErrorState.data).toBe(null);
    expect(mockErrorState.error).toBeInstanceOf(ZeroThrow.ZeroError);
    expect(mockErrorState.error?.code).toBe('TEST_ERR');
  });

  it('should handle loading state types', () => {
    const mockLoadingState: UseResultState<number> = {
      data: null,
      error: null,
      loading: true,
      refetch: () => {},
      reset: () => {},
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
    const fetchUser = async (
      id: number
    ): Promise<ZeroThrow.Result<{ name: string; id: number }>> => {
      if (id > 0) {
        return ZT.ok({ name: 'John Doe', id });
      }
      return ZT.err(new ZeroThrow.ZeroError('USER_NOT_FOUND', `User ${id} not found`));
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

  it('demonstrates error handling pattern - success case', async () => {
    const successfulOperation = async (): Promise<ZeroThrow.Result<string>> => {
      return ZT.ok('Success!');
    };

    // Test success case
    const successResult = await successfulOperation();
    expect(successResult.ok).toBe(true);
    if (successResult.ok) {
      expect(successResult.value).toBe('Success!');
    }
  });

  it('demonstrates error handling pattern - failure case', async () => {
    const failingOperation = async (): Promise<ZeroThrow.Result<string>> => {
      return ZT.err(
        new ZeroThrow.ZeroError('OPERATION_FAILED', 'Operation failed', {
          cause: new Error('Controlled failure'),
        })
      );
    };

    // Test failure case
    const failureResult = await failingOperation();
    expect(failureResult.ok).toBe(false);
    if (!failureResult.ok) {
      expect(failureResult.error.code).toBe('OPERATION_FAILED');
      expect(failureResult.error.message).toBe('Operation failed');
      expect(failureResult.error.cause).toBeInstanceOf(Error);
      expect((failureResult.error.cause as Error).message).toBe(
        'Controlled failure'
      );
    }
  });
});
